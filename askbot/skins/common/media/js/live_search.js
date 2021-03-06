var prevSortMethod = sortMethod;
var liveSearch = function(){
    var query = undefined;
    var prev_text = undefined;
    var running = false;
    var q_list_sel = 'question-list';//id of question listing div
    var search_url = undefined;
    var current_url = undefined;
    var restart_query = function(){};
    var process_query = function(){};
    var render_result = function(){};

    var refresh_x_button = function(){
        if ($.trim(query.val()).length > 0){
            if (query.attr('class') === 'searchInput'){
                query.attr('class', 'searchInputCancelable');
                x_button = $('<input class="cancelSearchBtn" type="button" name="reset_query"/>');
                //x_button.click(reset_query);
                x_button.val('X');
                x_button.click(
                    function(){
                        query.val('');
                        if (sortMethod === 'relevance-desc'){
                            sortMethod = prevSortMethod;
                        }
                        refresh_x_button();
                        new_url = remove_from_url(search_url, 'query')
                        search_url = askbot['urls']['questions'] + 'reset_query:true/';
                        reset_query(new_url,sortMethod);
                    }
                );
                query.after(x_button);
            }
        } else {
            $('input[name=reset_query]').remove();
            query.attr('class', 'searchInput');
        }
    };

    var reset_sort_method = function(){
        if (sortMethod === 'relevance-desc'){
            sortMethod = prevSortMethod;
            if (sortMethod === 'relevance-desc'){
                sortMethod = 'activity-desc';
            }
        } else {
            sortMethod = 'activity-desc';
            prevSortMethod = 'activity-desc';
        }
    };

    var eval_query = function(){
        cur_text = $.trim(query.val());
        if (cur_text !== prev_text && running === false){
            if (cur_text.length >= minSearchWordLength){
                process_query();
                running = true;
            } else if (cur_text.length === 0){
                restart_query();
            }
        }
    };

    var ask_page_search_listen = function(){
        running = false;
        var ask_page_eval_handle;
        query.keyup(function(e){
            if (running === false){
                clearTimeout(ask_page_eval_handle);
                ask_page_eval_handle = setTimeout(eval_query, 400);
            }
        });
    };

    var main_page_search_listen = function(){
        running = false;
        refresh_x_button();
        var main_page_eval_handle;
        query.keyup(function(e){
            refresh_x_button();
            if (running === false){
                clearTimeout(main_page_eval_handle);
                main_page_eval_handle = setTimeout(eval_query, 400);
            }
        });
    };

    var render_counter = function(count, word, counter_class, counter_subclass){
        var output = '<div class="' + counter_class + ' ' + counter_subclass + '">' +
                    '<span class="item-count">' +
                        count;
        if (counter_class === 'accepted'){
            output += '&#10003;';
        }
        output +=   '</span>' +
                    '<div>' + word + '</div>' +
                '</div>';
        return output;
    };

    var render_title = function(result){
        return '<h2>' +
                    '<a href="' + 
                            askbot['urls']['question_url_template']
                            .replace('{{QuestionID}}', result['id']) +
                    '" onmouseover="load_question_body(this,' + result['id'] + ')">' +
                        result['title'] +
                    '</a>' +
                '</h2>';
    };

    var render_user_link = function(result){
        if (result['u_id'] !== false){
            if (result['u_is_anonymous'] === true){
                return '<span class="anonymous">' + 
                            askbot['messages']['name_of_anonymous_user'] +
                       '</span>';
            } else {
                var u_slug = result['u_name'].toLowerCase().replace(/ +/g, '-');
                return '<a ' +
                            'href="' + 
                                askbot['urls']['user_url_template']
                                .replace('{{user_id}}', result['u_id'])
                                .replace('{{slug}}', u_slug) +
                        '">' +
                            result['u_name'] +
                        '</a> ';
            }
        }
        else {
            return '';
        }
    };

    var render_badge = function(result, key){
        return '<span ' + 
                    'title="' + result[key + '_title'] + '"' +
                '>' +
                '<span ' +
                    'class="' + result[key + '_css_class'] + '"' +
                '>' + result[key + '_badge_symbol'] + '</span>' +
                '<span class="badgecount">' + result[key] + '</span>';
    };

    var render_user_badge_and_karma = function(result){
        var rep_title = result['u_rep'] + ' ' + result['u_rep_word'];
        var html = '<span ' +
                        'class="reputation-score" ' +
                        'title="' + rep_title + '"' +
                    '>' + result['u_rep'] + '</span>';
        if (result['u_gold'] > 0){
            html += render_badge(result, 'u_gold');
        }
        if (result['u_silver'] > 0){
            html += render_badge(result, 'u_silver');
        }
        if (result['u_bronze'] > 0){
            html += render_badge(result, 'u_bronze');
        }
        return html;
    };

    var render_user_flag = function(result){
        var country_code = result['u_country_code'];
        if (country_code) {
            return '<img class="flag" src="'+ 
                   mediaUrl(
                        'media/images/flags/' + 
                        country_code.toLowerCase() +
                        '.gif'
                   ) +
                   '"/>';
        } else {
            return '';
        }
    };

    var render_user_info = function(result){
        var user_html = 
        '<div class="userinfo">' +
            '<span class="relativetime" ' +
                'title="' + result['timestamp'] + '"' +
            '>' +
            result['timesince'] +
            '</span> ' +
            render_user_link(result);
        if (result['u_is_anonymous'] === false){
            user_html += render_user_flag(result);
            //render_user_badge_and_karma(result) +
        }
        user_html += '</div>';
        return user_html;
    };

    var render_tag = function(tag_name, linkable, deletable, query_string){
        var tag = new Tag();
        tag.setName(tag_name);
        tag.setDeletable(deletable);
        tag.setLinkable(linkable);
        tag.setUrlParams(query_string);
        return tag.getElement().outerHTML();
    };

    var render_tags = function(tags, linkable, deletable, query_string){
        var tags_html = '<ul class="tags">';
        $.each(tags, function(idx, item){
            tags_html += render_tag(item, linkable, deletable, query_string);
        });
        tags_html += '</ul>';
        return tags_html;
    };

    var render_question = function(question, query_string){
        var entry_html = 
        '<div class="short-summary">' + 
            '<div class="counts">' +
                render_counter(
                    question['views'],
                    question['views_word'],
                    'views',
                    question['views_class']
                ) +
                render_counter(
                    question['answers'],
                    question['answers_word'],
                    'answers',
                    question['answers_class']
                ) +
                render_counter(
                    question['votes'],
                    question['votes_word'],
                    'votes',
                    question['votes_class']
                ) +
                '<div style="clear:both"></div>' +
                render_user_info(question) +
            '</div>' + 
            render_title(question) +
            render_tags(question['tags'], true, false, query_string) +
        '</div>';
        return entry_html;
    };

    var render_question_list = function(questions, query_string){
        var output = '';
        for (var i=0; i<questions.length; i++){
            output += render_question(questions[i], query_string);
        }
        return output;
    };

    var render_faces = function(faces){
        if (faces.length === 0){
            return;
        }
        $('#contrib-users>a').remove();
        var html = '';
        for (var i=0; i<faces.length; i++){
            html += faces[i];
        }
        $('#contrib-users').append(html);
    };

    var render_related_tags = function(tags, query_string){
        if (tags.length === 0){
            return;
        }
        var html = '';
        for (var i=0; i<tags.length; i++){
            html += render_tag(tags[i]['name'], true, false, query_string);
            html += '<span class="tag-number">&#215; ' +
                        tags[i]['used_count'] +
                    '</span>' +
                    '<br />';
        }
        $('#related-tags').html(html);
    };

    var render_paginator = function(paginator){
        var pager = $('#pager');
        if (paginator === ''){
            pager.hide();
            return;
        }
        else {
            pager.show();
            pager.html(paginator);
        }
    };

    var set_question_count = function(count_html){
        $('#questionCount').html(count_html);
    };

    var get_old_tags = function(container){
        var tag_elements = container.find('.tag');
        var old_tags = [];
        tag_elements.each(function(idx, element){
            old_tags.push($(element).html());
        });
        return old_tags;
    };

    var render_search_tags = function(tags, query_string){
        var search_tags = $('#searchTags');
        search_tags.children().remove();
        if (tags.length == 0){
            $('#listSearchTags').hide();
            $('#search-tips').hide();//wrong - if there are search users
        } else {
            $('#listSearchTags').show();
            $('#search-tips').show();
            var tags_html = '';
            $.each(tags, function(idx, tag_name){
                var tag = new Tag();
                tag.setName(tag_name);
                tag.setDeletable(true);
                tag.setLinkable(false);
                tag.setDeleteHandler(
                    function(){
                        remove_search_tag(tag_name, query_string);
                    }
                );
                search_tags.append(tag.getElement());
            });
        }
    };

    var create_relevance_tab = function(query_string){
        relevance_tab = $('<a></a>');
        href = '/questions/' + replace_in_url(query_string, 'sort:relevance-desc')
        relevance_tab.attr('href', href);
        relevance_tab.attr('id', 'by_relevance');
        relevance_tab.html('<span>' + sortButtonData['relevance']['label'] + '</span>');
        return relevance_tab;
    }

    var replace_in_url = function (query_string, param){
        values = param.split(':')
        type = values[0]
        value = values[1]
        params = query_string.split('/')
        url=""

        for (var i = 0; i < params.length; i++){
            if (params[i] !== ''){
                if (params[i].substring(0, type.length) == type){
                    url += param + '/'
                }
                else{
                    url += params[i] + '/'
                }
            }
        }
        return url   
    }

    var remove_from_url = function (query_string, type){
        params = query_string.split('/')
        url=""
        for (var i = 0; i < params.length; i++){
            if (params[i] !== ''){
                if (params[i].substring(0, type.length) !== type){
                    url += params[i] + '/'
                }
            }
        }
        return '/'+url   
    }

    var remove_tag_from_url =function (query_string, tag){
        url = askbot['urls']['questions'];
        flag = false
        author = ''
        if (query_string !== null){
            params = query_string.split('/')
            for (var i = 0; i < params.length; i++){
                if (params[i] !== ''){
                    if (params[i].substring(0, 5) == "tags:"){
                        tags = params[i].substr(5).split('+');
                        new_tags = ''
                        for(var j = 0; j < tags.length; j++){
                            if(escape(tags[j]) !== escape(tag)){
                                if (new_tags !== ''){
                                    new_tags += '+'
                                }
                                new_tags += escape(tags[j]);
                            }
                        }
                        if(new_tags !== ''){
                            url += 'tags:'+new_tags+'/'
                        }
                        flag = true
                    }
                    else if (params[i].substring(0, 7) == "author:"){
                        author = params[i];
                    }
                    else{
                        url += params[i] + '/';
                    }
                }
            }
            if (author !== '') {
                url += author+'/'
            }
        }
        return url

    }

    var set_section_tabs = function(query_string){
        var tabs = $('#section_tabs>a');
        tabs.each(function(index, element){
            var tab = $(element);
            var tab_name = tab.attr('id').replace(/^by_/,'');
            href = '/questions/' + replace_in_url(query_string, 'section:'+tab_name)
            tab.attr(
                'href',
                href
            );
        });
    };

    var set_active_sort_tab = function(sort_method, query_string){
        var tabs = $('#sort_tabs>a');
        tabs.attr('class', 'off');
        tabs.each(function(index, element){
            var tab = $(element);
            var tab_name = tab.attr('id').replace(/^by_/,'');
            if (tab_name in sortButtonData){
                href = '/questions/' + replace_in_url(query_string, 'sort:'+tab_name+'-desc')
                tab.attr(
                    'href',
                    href
                );
                tab.attr(
                    'title',
                    sortButtonData[tab_name]['desc_tooltip']
                );
                tab.html(sortButtonData[tab_name]['label']);
            }
        });
        var bits = sort_method.split('-', 2);
        var name = bits[0];
        var sense = bits[1];//sense of sort
        var antisense = (sense == 'asc' ? 'desc':'asc');
        var arrow = (sense == 'asc' ? ' &#9650;':' &#9660;');
        var active_tab = $('#by_' + name);
        active_tab.attr('class', 'on');
        active_tab.attr('title', sortButtonData[name][antisense + '_tooltip']);
        active_tab.html(sortButtonData[name]['label'] + arrow);
    };

    var render_relevance_sort_tab = function(query_string){
        if (showSortByRelevance === false){
            return;
        }
        var relevance_tab = $('#by_relevance');
        if (prev_text && prev_text.length > 0){
            if (relevance_tab.length == 0){
                relevance_tab = create_relevance_tab(query_string);
                $('#sort_tabs>span').after(relevance_tab);
            }
        }
        else {
            if (relevance_tab.length > 0){
                relevance_tab.remove();
            }
        }
    };

    var remove_search_tag = function(tag_name, query_string){
        $.ajax({
            url: askbot['urls']['questions']+'remove_tag:'+escape(tag_name)+'/',
            dataType: 'json',
            success: render_result,
            complete: try_again
        });
        search_url = remove_tag_from_url(query_string, tag_name)
        this.current_url = search_url
        var context = { state:1, rand:Math.random() };
        var title = "Questions";
        var query = search_url;
        History.pushState( context, title, query );

        //var stateObj = { page: search_url };
        //window.history.pushState(stateObj, "Questions", search_url);
    };

    var change_rss_url = function(feed_url){
        if(feed_url){
            $("#ContentLeft a.rss:first").attr("href", feed_url);
        }
    }

    var activate_search_tags = function(query_string){
        var search_tags = $('#searchTags .tag-left');
        $.each(search_tags, function(idx, element){
            var tag = new Tag();
            tag.decorate($(element));
            //todo: setDeleteHandler and setHandler
            //must work after decorate & must have getName
            tag.setDeleteHandler(
                function(){
                    remove_search_tag(tag.getName(), query_string);
                }
            );
        });
    };

    var render_ask_page_result = function(data, text_status, xhr){
        var container = $('#' + q_list_sel);
        container.fadeOut(200, function() {
            container.children().remove();
            $.each(data, function(idx, question){
                var url = question['url'];
                var title = question['title'];
                var answer_count = question['answer_count'];
                var list_item = $('<h2></h2>');
                var count_element = $('<span class="item-count"></span>');
                count_element.html(answer_count);
                list_item.append(count_element);
                var link = $('<a></a>');
                link.attr('href', url);
                list_item.append(link);
                title_element = $('<span class="title"></span>');
                title_element.html(title);
                link.append(title)
                container.append(list_item);
            });
            container.show();//show just to measure
            var unit_height = container.children(':first').outerHeight();
            container.hide();//now hide
            if (data.length > 5){
                container.css('overflow-y', 'scroll');
                container.css('height', unit_height*5 + 'px');
            } else {
                container.css('height', data.length*unit_height + 'px');
                container.css('overflow-y', 'hidden');
            }
            container.fadeIn();
        });
    };

    var render_main_page_result = function(data, text_status, xhr){
        var old_list = $('#' + q_list_sel);
        var new_list = $('<div></div>').hide();
        if (data['questions'].length > 0){
            old_list.stop(true);

            new_list.html(data['questions']);
            //old_list.hide();
            old_list.after(new_list);
            //old_list.remove();
            //rename new div to old
            render_paginator(data['paginator']);
            set_question_count(data['question_counter']);
            render_search_tags(data['query_data']['tags'], data['query_string']);
            render_faces(data['faces']);
            render_related_tags(data['related_tags'], data['query_string']);
            render_relevance_sort_tab(data['query_string']);
            set_active_sort_tab(sortMethod, data['query_string']);
            set_section_tabs(data['query_string']);
            change_rss_url(data['feed_url']);
            query.focus();

            //show new div with a fadeIn effect
            old_list.fadeOut(200, function() {
                old_list.remove();
                new_list.attr('id', q_list_sel);
                new_list.fadeIn(400);            
            });
        }
    }

    var try_again = function(){
        running = false;
        eval_query();
    }

    var send_query = function(query_text, sort_method){
        var post_data = {query: query_text};
        $.ajax({
            url: search_url,
            //data: {query: query_text, sort: sort_method},
            dataType: 'json',
            success: render_result,
            complete: try_again
        });
        prev_text = query_text;
        var context = { state:1, rand:Math.random() };
        var title = "Questions";
        var query = search_url;
        History.pushState( context, title, query );
        
        //var stateObj = { page: search_url };
        //window.history.pushState(stateObj, "Questions", search_url);
    }

    var reset_query = function(new_url, sort_method){
        $.ajax({
            url: search_url,
            //data: {reset_query: true, sort: sort_method},
            dataType: 'json',
            success: render_result,
            complete: try_again
        });
        prev_text = '';
        var context = { state:1, rand:Math.random() };
        var title = "Questions";
        var query = new_url;
        History.pushState( context, title, query );

        //var stateObj = { page: new_url };
        //window.history.pushState(stateObj, "Questions", new_url);
    }

    var refresh_main_page = function(){
        $.ajax({
            url: askbot['urls']['questions'],
            data: {preserve_state: true},
            dataType: 'json',
            success: render_main_page_result
        });


        var context = { state:1, rand:Math.random() };
        var title = "Questions";
        var query = askbot['urls']['questions'];
        History.pushState( context, title, query );

        //var stateObj = { page: askbot['urls']['questions'] };
        //window.history.pushState(stateObj, "Questions", askbot['urls']['questions']);
    };

    return {
        refresh: function(){
            query = $('input#keywords');
            refresh_main_page();
        },
        init: function(mode, query_string){
            if (mode === 'main_page'){
                //live search for the main page
                query = $('input#keywords');
                search_url = askbot['urls']['questions'];
                render_result = render_main_page_result;
                this.current_url = search_url + query_string
                process_query = function(){
                    if (prev_text.length === 0 && showSortByRelevance){
                        if (sortMethod === 'activity-desc'){
                            prevSortMethod = sortMethod;
                            sortMethod = 'relevance-desc';
                        }
                    }
                    if (this.current_url !== undefined){
                        search_url = '/'; //resetting search_url every times
                        query_string = this.current_url
                    }
                    else{
                        search_url = askbot['urls']['questions']; //resetting search_url every times
                    }
                    params = query_string.split('/')
                    for (var i = 0; i < params.length; i++){
                        if (params[i] !== ''){
                            if (params[i].substring(0, 5) == "sort:"){ //change the sort method
                                search_url += 'sort:'+sortMethod+'/'
                                search_url += 'query:'+ cur_text.split(' ').join('+') + '/' //we add the query here
                            }
                            else{
                                search_url += params[i] + '/';
                            }
                        }
                    }
                    send_query(cur_text, sortMethod);
                };
                restart_query = function() {
                    reset_sort_method();
                    refresh_x_button();
                    new_url = remove_from_url(search_url, 'query')
                    search_url = askbot['urls']['questions'] + 'reset_query:true/';
                    reset_query(new_url, sortMethod);
                    running = true;
                };

                activate_search_tags(query_string);
                main_page_search_listen();
            } else {
                query = $('input#id_title.questionTitleInput');
                search_url = askbot['urls']['api_get_questions'];
                render_result = render_ask_page_result;
                process_query = function(){
                    send_query(cur_text);
                };
                restart_query = function(){
                    $('#' + q_list_sel).css('height',0).children().remove();
                    running = false;
                    prev_text = '';
                    //ask_page_search_listen();
                };
                ask_page_search_listen();
            }
            prev_text = $.trim(query.val());
            running = false;
        }
    };

};
