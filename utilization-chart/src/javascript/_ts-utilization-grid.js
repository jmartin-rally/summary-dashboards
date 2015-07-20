Ext.define('Rally.technicalservices.grid.Legend', {
    extend: 'Rally.ui.grid.Grid',
    alias: 'widget.tslegendgrid',
    config: {
        series: undefined,
        columnCfgs: [],
        showRowActionsColumn: false,
        enableBulkEdit: false,
        padding: 10
    },

    constructor: function (config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },
    initComponent: function () {
        this.store = Ext.create('Rally.data.custom.Store',{
            data: this.records
        });
        this.columnCfgs = this._getColumnCfgs();
        this.addEvents('colorclicked');
        this.callParent(arguments);
    },
    _getColumnCfgs: function(){
        var me = this;

        return [{
            xtype:'actioncolumn',
            dataIndex: '__color',
            width: 24,
            handler: function(grid, rowIndex, colIndex, item) {
                var rec = grid.getStore().getAt(rowIndex);
                //Todo make background color gray when unclicked
                me.fireEvent('colorclicked', rec);
            },
            renderer: function(v, m, r){
                m.style = "background-color:" + r.get('__color');
                m.tdCls = "grid-legend-show-action"
            }
        },{
            dataIndex: 'Project',
            text: 'Project',
            flex: 3,
            renderer: this._projectNameRenderer
        },{
            dataIndex: 'Name',
            flex: 2,
            text: 'Iteration'
        },{
            dataIndex:'StartDate',
            text:'Start',
            flex: 2,
            renderer: this._dateRenderer
        },{
            dataIndex:'EndDate',
            text:'End',
            flex: 2,
            renderer: this._dateRenderer
        },{
            dataIndex:'PlannedVelocity',
            text:'&#9632; Potential (Planned)',
            flex: 1,
            editor: 'rallynumberfield',
            sortable: false,
            shape: 'square'
        },{
            dataIndex:'__startScope',
            flex: 1,
            text:'&#9679; Points at Start (Stability)',
            sortable: false,
            shape: 'circle'
        },{
            dataIndex:'__endScope',
            flex: 1,
            text:'&#9679; Points at End (Stability)',
            sortable: false,
            shape: 'circle'
        },{
            dataIndex:'__endAcceptance',
            flex: 1,
            text:'&#9660; Accepted at End',
            sortable: false,
            shape: 'triangle-down'
        }];
     },
    _dateRenderer: function(value){
        //todo make ordinals
        return Ext.util.Format.date(value,'Y-m-d');
    },
    
    _projectNameRenderer: function(value) {
        if ( !Ext.isEmpty(value) ) {
            var name_array = value.Name.split('>');
            return name_array[name_array.length - 1];
        }
        
        return value;
    },
    
    _objectNameRenderer: function(value){
        if (value && value.Name){
            return value.Name;
        }
        return value;
    }
});