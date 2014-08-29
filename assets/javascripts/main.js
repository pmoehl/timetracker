(function ($, config) {
    var jqTable = $("#timetable");
    var jqBody = jqTable.find("tbody");

    bindRowPinning(jqTable);

    $.ajax({
        "url": config.baseUri,
        "data": getRequestData(),
        "method": "GET",
        "dataType": "json",

        "success": function(data) {
            var rows = buildDataRows(data);

            $("#timetable").dataTable({
                "lengthMenu": [[-1], ["All"]],
                "order": [[ 0, "desc" ]],
                "dom": '<lf<t>i>',
                "footerCallback": footerCallback,
                "data": rows,
                "columns": [
                    { "data": "day_timestamp", "className": "day", "render": {
                            "_": formatDate,
                            "sort": function(data) {return data;}
                        }
                    },
                    { "data": "start_time", "className": "starttime" },
                    { "data": "end_time", "className": "endtime" },
                    { "data": "pause", "className": "pause", "render": formatTimespan},
                    { "data": "timespan", "className": "timespan", "render": formatTimespan},
                    { "data": "start_quarters", "className": "starttime" },
                    { "data": "end_quarters", "className": "endtime" },
                    { "data": "pause_quarters", "className": "pause" },
                    { "data": "timespan_quarters", "className": "timespan" },
                    { "data": "project_name", "className": "project" },
                    { "data": "comment", "className": "comment" }
                ]
            });
        },

        "error": function() {
            jqBody.append($("<tr><td>oops! an error happend!</td></tr>"));
        }

    });

    function getRequestData() {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        var startDate, year, month;
        if(now.getDate() > 15) {
            year = now.getFullYear();
            month = now.getMonth();
        }
        else {
            month = now.getMonth() - 1;
            if(month < 0) {
                month = 11;
                year = now.getFullYear() - 1;
            }
            else {
                year = now.getFullYear();
            }
        }
        startDate = new Date(year, month, 0, 0, 0, 0);


        // StartTime ist der Zeitpunkt bis zu den Daten geliefert werden
        var startTime = Math.round(today.getTime()/1000);
        // Timespan ist der Offset in die Vergangenheit bis wohin Daten geliefert werden
        var timespan =  Math.round( (today.getTime() - startDate.getTime())/1000 );

        return {
            "start_time": startTime,
            "timespan": timespan,
            "jive_user_id": config.userId
        };
    }

    function buildDataRows(data) {
        var rows = {};

        $.each(data.days, function(formattedDay, dayData) {
            $.each(dayData.timetable, function(id, timeData) {
                buildDataRow(formattedDay, dayData, id, timeData);
            });
        });


        function buildDataRow(formattedDay, dayData, id, timeData) {
            var rowKey = formattedDay + "#" + timeData.project_id;

            var rowData = rows[rowKey];
            var start_time = timeData.start_time.substring(11,16);
            var end_time = timeData.end_time.substring(11,16);
            // Date.parse requires the format YYYY-MM-DDTHH:mm:ss
            var start_timestamp = Date.parse(timeData.start_time.replace(" ", "T")) / 1000;
            var end_timestamp = Date.parse(timeData.end_time.replace(" ", "T")) / 1000;
            var day = new Date(start_timestamp * 1000);
            var day_timestamp = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 1000;
            if(!rowData) {
                rowData = {
                    "day_timestamp": day_timestamp,
                    "start_timestamp": start_timestamp,
                    "start_time": start_time,
                    "end_timestamp": end_timestamp,
                    "end_time": end_time,
                    "pause": 0,
                    "timespan": 0,
                    "project_name": timeData.project_name,
                    "comment": (timeData.comment) ? timeData.comment : "",
                    "hasMenu": true
                };
                rows[rowKey] = rowData;
            }
            else {
                if (start_timestamp < rowData.start_timestamp) {
                    rowData.pause = (rowData.start_timestamp - end_timestamp);

                    rowData.start_timestamp = start_timestamp;
                    rowData.start_time = start_time;
                }
                if (end_timestamp > rowData.end_timestamp) {
                    rowData.pause = (start_timestamp - rowData.end_timestamp);

                    rowData.end_timestamp = end_timestamp;
                    rowData.end_time = end_time;
                }
                if (timeData.comment && rowData.comment.indexOf(timeData.comment) == -1) {
                    rowData.comment += " " + timeData.comment;
                }
            }

            rowData.timespan += timeData.timespan;

            // Additional data
            rowData.start_quarters = roundToQuarters(rowData.start_timestamp - day_timestamp);
            rowData.end_quarters = roundToQuarters(rowData.end_timestamp - day_timestamp);
            rowData.pause_quarters = roundToQuarters(rowData.pause);
            rowData.timespan_quarters = roundToQuarters(rowData.timespan);
        }

        // Convert to array
        return $.map(rows, function(rowData, rowKey) {
            return [rowData];
        });
    }


    function roundToQuarters(timespan){
        if(timespan <= 0) {
            return "";
        }
        var hours = timespan / 60 / 60;
        hours = Math.round(hours * 100) / 100;
        hours = Math.round(hours * 4) / 4;
        return precise_round(hours, 2);
    }

    function precise_round(num, decimals) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    function formatDate(timestamp) {
        var date = new Date(timestamp*1000);
        return date.toLocaleDateString();
    }

    function formatTimespan(timespan) {
        if(timespan <= 0) {
            return "";
        }
        var hours = Math.floor(timespan / 60 / 60);
        var minutes = Math.floor(timespan / 60 - hours * 60);
        return pad(hours, 2) + "h&nbsp;" + pad(minutes, 2) + "m";
    }

    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    function bindRowPinning(jqTable){
        jqTable.click(function(e){
            clear();
            var jqTarget = $(e.target);
            jqTarget.parents("tr").addClass("pinned");
        });

        function clear(){
            jqTable.find("tr.pinned").removeClass("pinned");
        }
    }

    function buildActionMenu(rowData) {
        if(!rowData.hasMenu) {
            return '';
        }

        return '<div class="btn-group pull-right">' +
            '  <button type="button" class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown">' +
            '    <span class="glyphicon glyphicon-cog"></span>' +
            '  </button>' +
            '  <ul class="dropdown-menu" role="menu">' +
            '    <li><a href="#">Post to machold-portal</a></li>' +
            '  </ul>' +
            '</div>';
    }

    function footerCallback( tfoot, data, start, end, display ) {
        var api = this.api();
        var colData;

        // Anzahl der Tage
        colData = api.column( 0, {page: 'current'} ).data();
        $( api.column(0).footer() ).html('SUMME aus '+colData.length+' Tag(en)');

        // Summe der Dauer
        colData = api.column( 4, {page: 'current'} ).data();
        var timespanSum = formatTimespan(colData.length ?
                colData.reduce( function (a, b) {
                return a + b;
            } ) : 0
        );
        $( api.column(4).footer() ).html(timespanSum);

        // Summe der Dauer auf viertel Stunden gerundet
        colData = api.column( 8, {page: 'current'} ).data();
        var timespanQuarterSum = colData.length ?
            colData.reduce( function (a, b) {
                    return a + b;
                } ) : 0;
        $( api.column(8).footer() ).html(timespanQuarterSum);
    }

})(window.jQuery, window.timetrackerConfig);
