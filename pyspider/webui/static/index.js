// vim: set et sw=2 ts=2 sts=2 ff=unix fenc=utf8:
// Author: Binux<i@binux.me>
//         http://binux.me
// Created on 2014-03-02 17:53:23

function init_editable(projects_app) {
  $(".project-group>span").editable({
    name: 'group',
    pk: function(e) {
      return $(this).parents('tr').data("name");
    },
    emptytext: '[group]',
    placement: 'right',
    url: "/update",
    success: function(response, value) {
      var project_name = $(this).parents('tr').data("name");
      projects_app.projects[project_name].group = value;
      $(this).attr('style', '');
    }
  });

  $(".project-status>span").editable({
    type: 'select',
    name: 'status',
    source: [
      {value: 'TODO', text: 'TODO'},
      {value: 'STOP', text: 'STOP'},
      {value: 'CHECKING', text: 'CHECKING'},
      {value: 'DEBUG', text: 'DEBUG'},
      {value: 'RUNNING', text: 'RUNNING'}
    ],
    pk: function(e) {
      return $(this).parents('tr').data("name");
    },
    emptytext: '[status]',
    placement: 'right',
    url: "/update",
    success: function(response, value) {
      var project_name = $(this).parents('tr').data("name");
      projects_app.projects[project_name].status = value;
      $(this).removeClass('status-'+$(this).attr('data-value')).addClass('status-'+value).attr('data-value', value).attr('style', '');
    }
  });

  $(".project-rate>span").editable({
    name: 'rate',
    pk: function(e) {
      return $(this).parents('tr').data("name");
    },
    validate: function(value) {
      var s = value.split('/');
      if (s.length != 2)
        return "format error: rate/burst";
      if (!$.isNumeric(s[0]) || !$.isNumeric(s[1]))
        return "format error: rate/burst";
    },
    highlight: false,
    emptytext: '0/0',
    placement: 'right',
    url: "/update",
    success: function(response, value) {
      var project_name = $(this).parents('tr').data("name");
      var s = value.split('/');
      projects_app.projects[project_name].rate = parseFloat(s[0]);
      projects_app.projects[project_name].burst = parseFloat(s[1]);
      $(this).attr('style', '');
    }
  });
}

function init_sortable() {
  // table sortable
  Sortable.getColumnType = function(table, i) {
    var type = $($(table).find('th').get(i)).data('type');
    if (type == "num") {
      return Sortable.types.numeric;
    } else if (type == "date") {
      return Sortable.types.date;
    }
    return Sortable.types.alpha;
  };
  $('table.projects').attr('data-sortable', true);
  Sortable.init();
}

$(function() {
  $('.project-run').on('click', function() {
    var project = $(this).parents('tr').data("name");
    var status = $(this).parents('tr').find(".project-status [data-value]").attr("data-value");

    $("#need-set-status-alert").hide();
    if (status != "RUNNING" && status != "DEBUG") {
      $("#need-set-status-alert").show();
    }
    
    var _this = this;
    $(this).addClass("btn-warning");
    $.ajax({
      type: "POST",
      url: '/run',
      data: {
        project: project
      },
      success: function(data) {
        console.log(data);
        $(_this).removeClass("btn-warning");
        if (!data.result) {
          $(_this).addClass("btn-danger");
        }
      },
      error: function() {
        $(_this).removeClass("btn-warning").addClass("btn-danger");
      }
    });
  });

  //$("input[name=start-urls]").on('keydown', function(ev) {
    //if (ev.keyCode == 13) {
      //var value = $(this).val();
      //var textarea = $('<textarea class="form-control" rows=3 name="start-urls"></textarea>').replaceAll(this);
      //textarea.val(value).focus();
    //}
  //});

  $("#create-project-modal form").on('submit', function(ev) {
    var $this = $(this);
    var project_name = $this.find('[name=project-name]').val()
    if (project_name.length == 0 || project_name.search(/[^\w]/) != -1) {
      $this.find('[name=project-name]').parents('.form-group').addClass('has-error');
      $this.find('[name=project-name] ~ .help-block').show();
      return false;
    }
    var mode = $this.find('[name=script-mode]:checked').val();
    $this.attr('action', '/debug/'+project_name);
    return true;
  });

  // projects vue
  var projects_map = {};
  projects.forEach(function(p) {
    p.time = {};
    p.progress = {};
    projects_map[p.name] = p;
  });
  projects_app = new Vue({
    el: '.projects',
    data: {
      projects: projects_map
    },
    ready: function() {
      init_editable(this);
      init_sortable(this);
      update_counters();
    }
  });

  function update_counters() {
    $.get('/counter', function(data) {
      for (project in data) {
        var info = data[project];
        if (projects_app.projects[project] === undefined)
          continue;

        // data inject
        var types = "5m,1h,1d,all".split(',');
        for (type in types) {
          type = types[type];
          var d = info[type];
          if (d === undefined)
            continue;
          var pending = d.pending || 0,
            success = d.success || 0,
            retry = d.retry || 0,
            failed = d.failed || 0,
            sum = d.task || pending + success + retry + failed;
          d.task = sum;
          d.title = ""+type+" of "+sum+" tasks:\n"
            +(type == "all"
              ? "pending("+(pending/sum*100).toFixed(1)+"%): \t"+pending+"\n"
              : "new("+(pending/sum*100).toFixed(1)+"%): \t\t"+pending+"\n")
            +"success("+(success/sum*100).toFixed(1)+"%): \t"+success+"\n"
            +"retry("+(retry/sum*100).toFixed(1)+"%): \t"+retry+"\n"
            +"failed("+(failed/sum*100).toFixed(1)+"%): \t"+failed;
        }

        projects_app.projects[project].time = info['5m_time'];
        projects_app.projects[project].progress = info;
      }
    });
  }
  window.setInterval(update_counters, 15*1000);

  function update_queues() {
    $.get('/queues', function(data) {
      //console.log(data);
      $('.queue_value').each(function(i, e) {
        var attr = $(e).attr('title');
        if (data[attr] !== undefined) {
          $(e).text(data[attr]);
        } else {
          $(e).text('???');
        }
      });
    });
  }
  window.setInterval(update_queues, 15*1000);
  update_queues();
});
