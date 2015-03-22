var app = app || {};

(function ($) {
    // FIXME: This seems very wrong
    $('#server').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget);
        var modal = $(this);
        var title = 'Add server';

        $('.btn-danger', modal).hide();
        $('.callout-danger', modal).hide();
        $('.has-error', modal).removeClass('has-error');

        if (button.hasClass('btn-edit')) {
            title = 'Edit Server';
            $('.btn-danger', modal).show();
        } else {
            $('#server_id').val('');
            $('#server_name').val('');
            $('#server_address').val('');
            $('#server_user').val('');
            $('#server_path').val('');
        }

        modal.find('.modal-title span').text(title);
    });

    // FIXME: This seems very wrong
    $('#server button.save').on('click', function (event) {
        var target = $(event.currentTarget);
        var icon = target.find('i');
        var dialog = target.parents('.modal');

        icon.addClass('fa-refresh fa-spin').removeClass('fa-save');
        dialog.find('input').attr('disabled', 'disabled');
        $('button.close', dialog).hide();

        var server_id = $('#server_id').val();

        if (server_id) {
            var server = app.Servers.get(server_id);
        } else {
            var server = new app.Server();
        }

        server.save({
            name:       $('#server_name').val(),
            ip_address: $('#server_address').val(),
            user:       $('#server_user').val(),
            path:       $('#server_path').val(),
            project_id: $('input[name="project_id"]').val(),
            '_token':   $('meta[name="token"]').attr('content')
        }, {
            wait: true,
            success: function(model, response, options) {
                console.log('success!');
                dialog.modal('hide');
                $('.callout-danger', dialog).hide();

                icon.removeClass('fa-refresh fa-spin').addClass('fa-save');
                $('button.close', dialog).show();
                dialog.find('input').removeAttr('disabled');
            },
            error: function(model, response, options) {
                $('.callout-danger', dialog).show();

                var errors = response.responseJSON.errors;

                $('form input', dialog).each(function (index, element) {
                    element = $(element);

                    var name = element.attr('name');

                    if (typeof errors[name] != 'undefined') {
                        element.parent('div').addClass('has-error');
                    }
                });

                icon.removeClass('fa-refresh fa-spin').addClass('fa-save');
                $('button.close', dialog).show();
                dialog.find('input').removeAttr('disabled');
            }
        });
    });

    app.Server = Backbone.Model.extend({
        urlRoot: '/servers',
        poller: false,
        initialize: function() {
            this.on('change:status', this.changeStatus, this);
        },
        changeStatus: function() {
            if (this.get('status') === 'Testing') {
                var that = this;

                $.ajax({
                    type: 'GET',
                    url: this.urlRoot + '/' + this.id + '/test'
                }).fail(function (response) {
                    that.set({
                        status: 'Failed'
                    });
                }).success(function () {
                    that.poller = Backbone.Poller.get(that, {
                        condition: function(model) {
                            return model.get('status') === 'Testing';
                        },
                        delay: 2500
                    });
                    that.poller.start();
                });

            }
        }
    });

    var Servers = Backbone.Collection.extend({
        model: app.Server,
        comparator: function(serverA, serverB) {
            if (serverA.get('name') > serverB.get('name')) {
                return -1; // before
            } else if (serverA.get('name') < serverB.get('name')) {
                return 1; // after
            }

            return 0; // equal
        }
    });

    app.Servers = new Servers();

    app.ServersTab = Backbone.View.extend({
        el: '#app',
        events: {

        },
        initialize: function() {
            this.$list = $('#server_list tbody');

            this.listenTo(app.Servers, 'add', this.addOne);
            this.listenTo(app.Servers, 'reset', this.addAll);
            this.listenTo(app.Servers, 'all', this.render);
        },
        render: function () {
            if (app.Servers.length) {
                $('#no_servers').hide();
                $('#server_list').show();
            } else {
                $('#no_servers').show();
                $('#server_list').hide();
            }
        },
        addOne: function (server) {
            var view = new app.ServerView({ 
                model: server
            });

            this.$list.append(view.render().el);
        },
        addAll: function () {
            this.$list.html('');
            app.Servers.each(this.addOne, this);
        }
    });

    app.ServerView = Backbone.View.extend({
        tagName:  'tr',
        template: _.template($('#server-template').html()),
        events: {
            'click .btn-test': 'testConnection',
            'click .btn-edit': 'editServer'
        },
        initialize: function () {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);
        },
        render: function () {
            var data = this.model.toJSON();

            data.status_css = 'primary';
            data.icon_css = 'question';

            if (this.model.get('status') === 'Successful') {
                data.status_css = 'success';
                data.icon_css = 'check';
            } else if (this.model.get('status') === 'Testing') {
                data.status_css = 'warning';
                data.icon_css = 'spinner';
            } else if (this.model.get('status') === 'Failed') {
                data.status_css = 'danger';
                data.icon_css = 'warning';
            }

            this.$el.html(this.template(data));

            return this;
        },
        editServer: function() {
            $('#server_id').val(this.model.id);
            $('#server_name').val(this.model.get('name'));
            $('#server_address').val(this.model.get('ip_address'));
            $('#server_user').val(this.model.get('user'));
            $('#server_path').val(this.model.get('path'));
        },
        testConnection: function() {
            if (this.model.get('status') === 'Testing') {
                return;
            }

            this.model.set({
                status: 'Testing'
            });
        }
    });
})(jQuery);