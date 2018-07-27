/*
 * Copyright (c) 2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

import GridSearchVue from 'components/common/GridSearchVue.html';

import constants from 'core/constants';
import utils from 'core/utils';
import uiCommonLib from 'admiral-ui-common';

/**
 * General search component shown on grid views.
 */
var GridSearch = Vue.extend({
  template: GridSearchVue,

  props: {
    queryOptions: {
      type: Object
    },
    placeholder: {
      type: String,
      required: false
    },
    filterTagName: {
      type: String,
      required: false
    },
    filterTagValue: {
      type: String,
      required: false
    }
  },

  data: function() {
    return {
      searchString: '',
      occurrenceSelection: constants.SEARCH_OCCURRENCE.ALL
    };
  },

  attached: function() {
    this.unwatchQueryOptions = this.$watch('queryOptions', (newQueryOptions, oldQueryOptions) => {
      if (!utils.equals(oldQueryOptions, newQueryOptions)) {
        let oldSearchString = uiCommonLib.searchUtils.getSearchString(oldQueryOptions);
        let oldOccurrenceSelection = uiCommonLib.searchUtils.getOccurrence(oldQueryOptions);

        this.searchString = uiCommonLib.searchUtils.getSearchString(newQueryOptions);
        if (this.filterTagName) {
          if (!this.filterTagValue) {
            this.filterTagValue = newQueryOptions[this.filterTagName];
          }
          this.searchString = this.stripTagString(this.searchString);
          oldSearchString = this.stripTagString(oldSearchString);
        }

        this.occurrenceSelection = uiCommonLib.searchUtils.getOccurrence(newQueryOptions);
        if (!this.occurrenceSelection) {
          this.occurrenceSelection = constants.SEARCH_OCCURRENCE.ALL;
        }

        if (oldSearchString !== this.searchString
              || oldOccurrenceSelection !== this.occurrenceSelection) {
          this.search();
        }
      }
    }, { immediate: true });
  },

  detached: function() {
    this.unwatchQueryOptions();
  },

  methods: {
    getQueryOptions: function() {
      return this.search.getQueryOptions();
    },

    onSearch: function($event) {
      $event.preventDefault();
      $event.stopPropagation();

      this.search();
    },

    search: function() {
      if (this.filterTagName && this.filterTagValue) {
        this.searchString = this.stripTagString(this.searchString);
      }

      let searchQueryOptions =
              uiCommonLib.searchUtils.getQueryOptions(this.searchString, this.occurrenceSelection);

      this.$dispatch('search-grid-action', searchQueryOptions);
    },

    stripTagString: function() {
      let resultSearchString = this.searchString;

      if (resultSearchString.indexOf(this.filterTagName) > -1) {
        // remove search tag name
        let stringToRemove = this.filterTagName + ': ' + this.filterTagValue;
        resultSearchString = resultSearchString.replace(stringToRemove, '');
        resultSearchString = resultSearchString.trim();
      }

      return resultSearchString;
    }
  }
});

Vue.component('grid-search', GridSearch);

export default GridSearch;
