// ##############################################################################
// #    odtree
// #    author:15251908@qq.com (openliu)
// #    license:'LGPL-3
// #
// ##############################################################################
odoo.define('odtree', function (require) {
    "use strict";

    var core = require('web.core');
    var ajax = require('web.ajax');
    var ListView = require('web.ListView');
    var KanbanView = require('web_kanban.KanbanView');
    //var data = require('web.data');
    var pyeval = require('web.pyeval');
    var qweb = core.qweb;

    var node_id_selected = 0;
    var treejson = [];
    var treeObj;
    var last_view_id;
    var acitve_view;

    var buildTree = function (view, categ_model, categ_parent_key, categ_model_domain) {
        acitve_view=view;
        var setting = {
            data: {
                simpleData: {
                    enable: true
                }
            },
            callback: {
                onClick: function (event, treeId, treeNode, clickFlag) {
                    node_id_selected = treeNode.id;
                    var search_view = view.getParent().searchview;
                    var search_data = search_view.build_search_data();
                    var domains = search_data.domains;
                    search_view.do_search(domains, search_data.contexts, search_data.groupbys || []);
                }
            }
        };
        var fields = ['id', 'name'];
        if (categ_parent_key != null) {
            fields.push(categ_parent_key);
        }
        //var ctx = view.dataset.get_context().__contexts[0] || {};
        var ctx = view.dataset.context || {};
//        var ctx = pyeval.eval(
//            'context', new data.CompoundContext(
//                view.dataset.get_context(), {}));

        if (categ_model_domain && categ_model_domain.indexOf('active_id')>0 && ctx.active_id){
            categ_model_domain=categ_model_domain.replace(/active_id/g,ctx.active_id);
        }


        categ_model_domain = pyeval.eval('domain', categ_model_domain || []);
        ajax.jsonRpc('/web/dataset/call_kw', 'call', {
            model: categ_model,
            method: 'search_read',
            args: [],
            kwargs: {
                domain: categ_model_domain,
                fields: fields,
                // order: 'id asc',
                context: ctx
            }
        }).then(function (respdata) {
            if (respdata.length > 0) {
                var treejson_cur = [];
                for (var index = 0; index < respdata.length; index++) {
                    var obj = respdata[index];
                    var parent_id = 0;
                    if (obj.hasOwnProperty(categ_parent_key)) {
                        parent_id = obj[categ_parent_key];
                        if (parent_id !== null || parent_id !== undefined || parent_id !== false) {
                            parent_id = parent_id[0];
                        }
                    }
                    treejson_cur.push({id: obj['id'], pId: parent_id, name: obj['name'], open: true});
                }

                if (view.getParent().$('.o_list_view_categ').length === 0
                    || last_view_id !== view.fields_view.view_id
                    || (JSON.stringify(treejson) !== JSON.stringify(treejson_cur))) {
                    last_view_id = view.fields_view.view_id;
                    view.getParent().$('.o_list_view_categ').remove();
                    view.getParent().$('.o_kanban_view').addClass(' col-xs-12 col-md-10');
                    treejson=treejson_cur;

                    var fragment = document.createDocumentFragment();
                    var content = qweb.render('Odtree');
                    $(content).appendTo(fragment);
                    view.getParent().$el.prepend(fragment);
                    treeObj = $.fn.zTree.init(view.getParent().$('.ztree'), setting, treejson);

                    //hidden button bind action

                    view.getParent().$(".handle_menu_arrow").on('click', function (e) {
                       //change icon and reverse catgtree's display prop

                       if ( view.getParent().$('.handle_menu_arrow').hasClass("handle_menu_arrow_left")){
                                view.getParent().$('.odtree_control_panel').css("display","none");
                                view.getParent().$('.o_list_view_categ').css("border-right", "0px");
                                view.getParent().$('.handle_menu_arrow').removeClass("handle_menu_arrow_left");
                                view.getParent().$('.handle_menu_arrow').addClass("handle_menu_arrow_right");
                                view.getParent().$('.ztree').css("display","none");
                                view.getParent().$('.o_list_view_categ').removeClass('col-xs-12 col-md-2');
                                view.getParent().$('.o_list_view_categ').addClass('o_list_view_categ_hidden');
                                view.getParent().$('.o_kanban_view').removeClass(' col-xs-12 col-md-10');
                        }else{
                                view.getParent().$('.odtree_control_panel').css("display","block");
                                view.getParent().$('.o_list_view_categ').css({"border-right": "1px solid #b9b9b9"});
                                view.getParent().$('.handle_menu_arrow').removeClass("handle_menu_arrow_right");
                                view.getParent().$('.handle_menu_arrow').addClass("handle_menu_arrow_left");
                                view.getParent().$('.ztree').css("display","block");
                                view.getParent().$('.o_list_view_categ').removeClass('o_list_view_categ_hidden');
                                view.getParent().$('.o_list_view_categ').addClass('col-xs-12 col-md-2');
                                view.getParent().$('.o_kanban_view').addClass(' col-xs-12 col-md-10');
                        }
                    });
                }
                if (node_id_selected != null && node_id_selected > 0) {
                    var node = treeObj.getNodeByParam('id', node_id_selected, null);
                    treeObj.selectNode(node);
                }

            }

        });

    };


    ListView.include({

        do_search: function (domain, context, group_by) {
            if (this.fields_view.arch.attrs.categ_property && this.fields_view.arch.attrs.categ_model) {
                if (node_id_selected != null && node_id_selected > 0) {
                    var checkbox = this.getParent().$('#include_children').get(0);
                    var include_children = checkbox && checkbox.checked;
                    var operation = include_children ? 'child_of' : '=';
                    arguments[0][arguments[0].length] = [this.fields_view.arch.attrs.categ_property, operation, node_id_selected];
                }
            }
            return this._super.apply(this, arguments);
        },

        load_list: function () {
            var result = this._super.apply(this, arguments);
            var self = this;
            if (this.fields_view.arch.attrs.categ_property && this.fields_view.arch.attrs.categ_model) {
                this.$('.table-responsive').addClass("o_list_view_width_withcateg");
                this.$('.table-responsive').css("overflow-x", "auto");
                buildTree(this, this.fields_view.arch.attrs.categ_model, this.fields_view.arch.attrs.categ_parent_key, this.fields_view.arch.attrs.categ_model_domain);
            } else {
                this.getParent().$('.o_list_view_categ').remove();
            }
            return result;
        }
    });


    KanbanView.include({

        do_search: function (domain, context, group_by) {
            if (this.fields_view.arch.attrs.categ_property && this.fields_view.arch.attrs.categ_model) {
                if (node_id_selected != null && node_id_selected > 0) {
                    var checkbox = this.getParent().$('#include_children').get(0);
                    var include_children = checkbox && checkbox.checked;
                    var operation = include_children ? 'child_of' : '=';
                    arguments[0][arguments[0].length] = [this.fields_view.arch.attrs.categ_property, operation, node_id_selected];
                }
            }
            return this._super.apply(this, arguments);
        },

        render: function () {
            var result = this._super.apply(this, arguments);
            if (this.fields_view.arch.attrs.categ_property && this.fields_view.arch.attrs.categ_model) {
                buildTree(this, this.fields_view.arch.attrs.categ_model, this.fields_view.arch.attrs.categ_parent_key, this.fields_view.arch.attrs.categ_model_domain);
            } else {
                this.getParent().$('.o_list_view_categ').remove();
            }
            return result;
        }
    });



});
