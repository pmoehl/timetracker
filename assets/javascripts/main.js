(function ($, config) {
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

    var jqBody = $("#timetable").find("tbody");
    $.ajax({
        "url": config.baseUri+"?start_time="+startTime+"&timespan="+timespan+"&jive_user_id="+config.userId,
        "method": "GET",
        "dataType": "json",

        "success": function(data) {
            var rows = {};
            var sumData = {
                "day": "SUMME",
                "pause": 0,
                "timespan": 0
            };
            rows["SUM"] = sumData;

            $.each(data.days, function(formattedDay, dayData) {
                $.each(dayData.timetable, function(id, timeData) {
                    var rowKey = formattedDay + "#" + timeData.project_id;

                    var rowData = rows[rowKey];
                    var start_time = timeData.start_time.substring(11,16);
                    var end_time = timeData.end_time.substring(11,16);
                    var start_timestamp = Date.parse(timeData.start_time);
                    var end_timestamp = Date.parse(timeData.end_time);
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
                            "comment": timeData.comment
                        };
                        rows[rowKey] = rowData;
                    }
                    else {
                        if(start_timestamp < rowData.start_timestamp) {
                            rowData.pause = (rowData.start_timestamp - end_timestamp) / 1000;

                            rowData.start_timestamp = start_timestamp;
                            rowData.start_time = start_time;
                        }
                        if(end_timestamp > rowData.end_timestamp) {
                            rowData.pause = (start_timestamp - rowData.end_timestamp) / 1000;

                            rowData.end_timestamp = end_timestamp;
                            rowData.end_time = end_time;
                        }
                        rowData.comment += " " + timeData.comment;
                    }

                    rowData.timespan += timeData.timespan;

                    sumData.timespan += timeData.timespan;
                });
            });

            $.each(rows, function(rowKey, rowData) {
                var jqRow = createRow(rowKey, rowData);
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

    function createRow(rowKey, rowData){
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

})(window.jQuery, window.timetrackerConfig);
