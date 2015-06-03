Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {

        var release = null;
        var iteration = "Iteration 1"; // this.getTimeboxScope();

        var that = this;
        var tbs = that.getTimeboxScope();
        if (!_.isNull(tbs)) {
            release = tbs.type === "release" ? tbs.name : null;
            iteration = tbs.type === "iteration" ? tbs.name : null;
        }
        that.run(release,iteration);

    },

    run : function(releaseName,iterationName) {

        var that = this;

        that.workItemFilter = that.createFilter(releaseName,iterationName);
        console.log(that.workItemFilter.toString());

        var fns = [
            that.readStates.bind(that),
            that.readProjects.bind(that),
            that.getReportProjects.bind(that),
            that.readStories.bind(that),
            that.prepareChartData.bind(that),
            that.createChart.bind(that)
        ];

        async.waterfall( fns , function(err,result) {
            console.log("result",result);
            // console.log("parents",_.map(result,function(r){return r.get("Project")}));
        });

    },

    getTimeboxScope : function() {
        var timeboxScope = this.getContext().getTimeboxScope();
        if (timeboxScope) {
            return { type : timeboxScope.getType(), name : timeboxScope.getRecord().get("Name") };
        }
        return null;
    },

    onTimeboxScopeChange: function(newTimeboxScope) {
        this.callParent(arguments);
        if ((newTimeboxScope) && (newTimeboxScope.getType() === 'iteration')) {
            this.run(null,newTimeboxScope.getRecord().get("Name"));
        } else {
            if ((newTimeboxScope) && (newTimeboxScope.getType() === 'release')) {
                this.run(newTimeboxScope.getRecord().get("Name"),null);
            }
        }
    },

    // read the schedule states so we can include if necessary
    readStates : function(callback) {

        var that = this;

        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function(model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        that.scheduleStates = _.map(records,function(r){ return r.get("StringValue");});
                        callback(null);
                    }
                });
            }
        });

    },

    readProjects : function(callback) {

        var that = this;
        var config = { model : "Project", fetch : true, filters : [] };
        that._wsapiQuery(config,callback);

    }, 

    // child projects are what we graph
    getReportProjects : function(projects,callback) {

        var that = this;

        that.projects = projects;

        // filter to projects which are child of the current context project
        that.reportProjects = _.filter(projects, function(project) {
            return that._isChildOf( project, that.getContext().getProject() );
        });

        // if no children add self
        if (that.reportProjects.length ===0) {
            that.reportProjects.push(_.find(that.projects,function(project) {
                return project.get("ObjectID") === that.getContext().getProject().ObjectID;
            }));
        }

        callback(null);
    },

    readStories : function(callback) {

        var that = this;

        var configs = _.map(that.reportProjects,function(project) {
            return {
                model : "HierarchicalRequirement",
                filters : [that.workItemFilter],
                fetch : ["ObjectID","ScheduleState","PlanEstimate","Project"],
                context : {
                    project: project.get("_ref"),
                    projectScopeUp: false,
                    projectScopeDown: true
                }
            }
        });

        // read stories for each reporting project
        async.map(configs,that._wsapiQuery,function(error,results) {
            console.log("stories",results);
            callback(null,results)
        });
    },

    prepareChartData : function(stories,callback) {

        var that = this;
        var categories = _.map(that.reportProjects,function(p) { return p.get("Name"); });
        var completedStates = ["Accepted",_.last(that.scheduleStates)];

        var pointsValue = function(value) {
            return !_.isUndefined(value) && !_.isNull(value) ? value : 0;
        };

        // totals points for a set of work items based on if they are in a set of states
        var summarize = function( workItems, states ) {
            var stateTotal = _.reduce(  workItems, function(memo,workItem) {
                    return memo + ( _.indexOf(states,workItem.get("ScheduleState")) > -1 ? 
                            pointsValue(workItem.get("PlanEstimate")) : 0);
                },0);
            return stateTotal;
        };

        var data = _.map(categories,function(project,index){
            return [ project, 
                     summarize(stories[index],that.scheduleStates),
                     summarize(stories[index],completedStates)
                    ];
        });
        var sortedData = data.sort(function(a,b) { return b[1] - a[1] })

        var seriesData = [{
            name : 'Project Scope',
            data : sortedData,
            completedData : _.map(sortedData,function(d) { return d[2];})
        }];

        console.log("seriesData",seriesData);

        callback(null,categories,seriesData);
    },

    createChart : function(categories,seriesData,callback) {

        var that = this;

        var chartConfig = {
            colors : ["#3498db","#f1c40f","#c0392b","#9b59b6","#2ecc71"],
             chart: {
                type: 'pyramid',
                marginRight : 100
            },
            title: {
                text: 'Success Chart'
            },
            plotOptions: {
                pyramid : {
                    allowPointSelect : true
                },
                series: {
                    dataLabels: {
                        enabled: true,
                        formatter : function() {
                            console.log(this);
                            var scope = this.point.y;
                            var completed = this.point.series.options.completedData[this.point.index];
                            var pct = Math.round( scope > 0 ? (completed/scope)*100 : 0);
                            return " [" + completed + "/" + scope + "] ("+pct+"%) " + 
                                _.last(this.point.name.split(">"));
                        },
                        softConnector: true,
                        distance : 10
                    }
                }
            },
            legend : {
                enabled : false
            },
            series: seriesData
        }

        if (!_.isUndefined(that.x)) {
            that.remove(that.x);
        }

        that.x = Ext.widget('container',{
            autoShow: true ,shadow: false,title: "",resizable: false,margin: 10,
            html: '<div id="chart-container" class="chart-container"></div>',
            listeners: {
                resize: function(panel) {
                },
                afterrender : function(panel) {
                    $('#chart-container').highcharts(chartConfig);
                }
            }
        });
        that.add(that.x);


    },

    // create a filter based on a combination of release and/or iteration
    createFilter : function( releaseName, iterationName ) { 
        var filter = null;

        if (!_.isNull(releaseName)) {
            filter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'Release.Name',
                operator: '=',
                value: releaseName
            });
        }

        if (!_.isNull(iterationName)) {
            var ifilter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'Iteration.Name',
                operator: '=',
                value: iterationName
            });

            filter = _.isNull(filter) ? ifilter : filter.and(ifilter);              
        }
        return filter;
    },

    _isChildOf : function( child, parent ) {
        var childParentRef = !_.isNull(child.get("Parent")) ? child.get("Parent")._ref : "null";
        return parent._ref.indexOf( childParentRef ) > -1;
    },

    // generic function to perform a web services query    
    _wsapiQuery : function( config , callback ) {

        var storeConfig = {
            autoLoad : true,
            limit : "Infinity",
            model : config.model,
            fetch : config.fetch,
            filters : config.filters,
            listeners : {
                scope : this,
                load : function(store, data) {
                    callback(null,data);
                }
            }
        };

        if (!_.isUndefined(config.context)) {
            storeConfig["context"] = config.context;
        }
        
        Ext.create('Rally.data.WsapiDataStore', storeConfig);
    }

});
