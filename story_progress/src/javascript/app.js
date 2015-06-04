Ext.define("TSStoryProgressPie", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [ 
        {xtype:'tsinfolink', minHeight: 18},
        {xtype:'container',itemId:'display_box', layout: { type: 'hbox' }, items: [
            { xtype: 'container', itemId: 'self_chart' },
            { xtype: 'container', itemId: 'team_chart' }
        ] }
    ],
    launch: function() {
        var me = this;
        this._setInfo(); 
                
        var base_filter = [{property:'ObjectID',operator:'>',value:0}];
        
        var team_story_filters = Ext.Array.push([],base_filter);
        team_story_filters.push({property:'ScheduleState',value:'In-Progress'});

        var team_task_filters = Ext.Array.push([],base_filter);
        var task_fields = ['Estimate','FormattedID','WorkProduct','PlanEstimate','Blocked','State','Owner','ObjectID'];
        var story_fields = ['PlanEstimate','FormattedID','Blocked','Owner','ObjectID'];
        
        Deft.Chain.sequence([
            function() { return me._loadAStoreWithAPromise('UserStory', story_fields, team_story_filters); },
            function() { return me._loadAStoreWithAPromise('Task', task_fields, team_task_filters); }
            
        ]).then({
            scope: this,
            success: function(results) {
                var stories = results[0];
                var tasks = results[1];
                
                this._makePies(stories,tasks);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    _loadAStoreWithAPromise: function(model_name, model_fields,filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.setLoading("Finding " + model_name + " records");
                  
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: filters
        }).load({
            callback : function(records, operation, successful) {
                me.setLoading(false);
                
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _makePies: function(inside_records,outside_records){
        var container =  this.down('#display_box');

        container.down('#self_chart').removeAll();
        container.down('#team_chart').removeAll();
        
        container.down('#self_chart').add({
            xtype: 'tsdoughnut',
            title: 'Self',
            itemId: 'selfie',
            width: 300,
            highlight_owner: this.getContext().getUser().ObjectID,
            remove_non_highlighted: true,
            inside_records: inside_records,
            inside_size_field: 'PlanEstimate',
            outside_records: outside_records,
            outside_size_field: 'Estimate'
        });
        container.down('#team_chart').add( {
            xtype: 'tsdoughnut',
            title: 'Team',
            width: 300,
            itemId: 'team',
            inside_records: inside_records,
            inside_size_field: 'PlanEstimate',
            outside_records: outside_records,
            outside_size_field: 'Estimate'
        });

    },
    
    _setInfo: function() {
        var chart_info = [];
        
        chart_info.push("These charts show stories in the In Progress state with their tasks.");
        chart_info.push("Gray tasks on the Self chart represent tasks that belong to someone other than the current user");
        chart_info.push("The 'lightness' of tasks represents progress from Defined (darkest) to Completed (brightest)");
        chart_info.push("White tasks on either chart represent a story not having any tasks");
        chart_info.push("Size of story slices is based upon Plan Estimate");
        chart_info.push("Size of task slices is based on Estimate. (If none of the tasks on a story have Estimates, they are distributed evenly across the story.)")
        
        this.down('tsinfolink').informationHtml = chart_info.join('<br/>');
    }

            
});
