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

            $.each(rows, function(rowKey, rowData) {
                var jqRow = createHtmlRow(rowKey, rowData);
                jqRow.appendTo(jqBody);
            });

            $("#timetable").dataTable({
                "lengthMenu": [[-1], ["All"]],
                "order": [[ 0, "desc" ]],
                "dom": '<lf<t>i>'
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
                addToSumRow(timeData);
            });
        });


        function buildDataRow(formattedDay, dayData, id, timeData) {
            var rowKey = formattedDay + "#" + timeData.project_id;

            var rowData = rows[rowKey];
            var start_time = timeData.start_time.substring(11,16);
            var end_time = timeData.end_time.substring(11,16);
            // Date.parse requires the format YYYY-MM-DDTHH:mm:ss
            var start_timestamp = Date.parse(timeData.start_time.replace(" ", "T"));
            var end_timestamp = Date.parse(timeData.end_time.replace(" ", "T"));
            if(!rowData) {
                rowData = {
                    "day": formattedDay+"&nbsp;"+dayData.timeWeekday,
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
                    rowData.pause = (rowData.start_timestamp - end_timestamp) / 1000;

                    rowData.start_timestamp = start_timestamp;
                    rowData.start_time = start_time;
                }
                if (end_timestamp > rowData.end_timestamp) {
                    rowData.pause = (start_timestamp - rowData.end_timestamp) / 1000;

                    rowData.end_timestamp = end_timestamp;
                    rowData.end_time = end_time;
                }
                if (timeData.comment && rowData.comment.indexOf(timeData.comment) == -1) {
                    rowData.comment += " " + timeData.comment;
                }
            }

            rowData.timespan += timeData.timespan;
        }

        function addToSumRow(timeData) {
            // Sum data per project id
            var sumKey = "SUM"+timeData.project_id;
            var sumData = rows[sumKey];
            if(!sumData) {
                sumData = {
                    "day": "SUMME",
                    "pause": 0,
                    "timespan": 0,
                    "project_name": timeData.project_name,
                    "hasMenu": false
                };
                rows[sumKey] = sumData;
            }

            sumData.timespan += timeData.timespan;
        }

        return rows;
    }

    function createHtmlRow(rowKey, rowData){
        var jqRow = $("<tr/>");

        jqRow.append($("<td/>", {"html":rowData.day, "class": "day"}));
        jqRow.append($("<td/>", {"text":rowData.start_time, "class": "starttime"}));
        jqRow.append($("<td/>", {"text":rowData.end_time, "class": "endtime"}));
        jqRow.append($("<td/>", {"html":formatTimespan(rowData.timespan), "class": "timespan"}));
        jqRow.append($("<td/>", {"html":formatTimespan(rowData.pause), "class": "pause"}));
        jqRow.append($("<td/>", {"html":roundToQuarters(rowData.timespan), "class": "timespan-num"}));
        jqRow.append($("<td/>", {"html":roundToQuarters(rowData.pause), "class": "pause-num"}));
        jqRow.append($("<td/>", {"text":rowData.project_name, "class": "project"}));
        jqRow.append($("<td/>", {"text":rowData.comment, "class": "comment"}));
        jqRow.append($("<td/>", {"html":buildActionMenu(rowData), "class": "action"}));

        return jqRow;
    }

    function roundToQuarters(timespan){
        if(timespan <= 0) {
            return "";
        }
        var hours = timespan / 60 / 60;
        hours = Math.round(hours * 100) / 100;
        hours = Math.round(hours * 4) / 4;
        return hours.toFixed(2);
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

        return '<div class="btn-group">' +
            '  <button type="button" class="btn btn-default btn-xs dropdown-toggle" data-toggle="dropdown">' +
            '    <span class="glyphicon glyphicon-cog"></span>' +
            '  </button>' +
            '  <ul class="dropdown-menu" role="menu">' +
            '    <li><a href="#">Post to machold-portal</a></li>' +
            '  </ul>' +
            '</div>';
    }

})(window.jQuery, window.timetrackerConfig);
