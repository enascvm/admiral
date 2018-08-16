/*
 * Copyright (c) 2016-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

import ContainerDefinitionFormTemplate from
  'components/containers/ContainerDefinitionFormTemplate.html';
import MulticolumnInputs from 'components/common/MulticolumnInputs';
import Component from 'components/common/Component';
import utils from 'core/utils';
import ft from 'core/ft';
import { formatUtils } from 'admiral-ui-common';
import imageUtils from 'core/imageUtils';
import definitionFormUtils from 'core/definitionFormUtils';
import constants from 'core/constants';
import { TemplateActions } from 'actions/Actions';

class ContainerDefinitionForm extends Component {
  constructor(kubernetes) {
    super();
    this.kubernetes = kubernetes;

    this.$el = $(ContainerDefinitionFormTemplate());

    this.$el.find('.fa-question-circle').tooltip({html: true});

    this.$imageSearch = this.$el.find('.container-image-input .image-name-input .form-control');
    this.$imageSearch.typeahead({}, {
      name: 'images',
      source: definitionFormUtils.typeaheadSource(
        this.$el.find('.container-image-input .image-name-input'))
    });

    this.$imageTags = this.$el.find('.container-image-input .image-tags-input .form-control');
    definitionFormUtils.setTagsTypeahead(this.$imageTags, []);

    this.$tagsHolder = this.$el.find('.container-image-input .image-tags-input');
    this.$imageSearch.bind(
      'typeahead:selected', definitionFormUtils.typeaheadTagsLoader(this.$tagsHolder));

    this.$imageSearch.blur(() => {
      var image = this.$imageSearch.typeahead('val');
      var tag = this.$imageTags.typeahead('val');
      definitionFormUtils.loadTags(this.$tagsHolder, image, tag);
    });

    this.commandsEditor = new MulticolumnInputs(
      this.$el.find('.container-commands-input .form-control'), {
        command: {
          placeholder: i18n.t('app.container.request.inputs.commandsInputs.commandHint',
              {defaultValue: ''})
        }
      }
    );


    if (this.kubernetes) {
      this.$el.find('.container-links-input').hide();
      this.$el.find('.container-networks-input').hide();
      this.$el.find('.container-volumes-input').hide();
      this.$el.find('.container-affinity-constraints-input').hide();
      this.$el.find('.container-custom-properties-input').hide();
      this.$el.find('.container-ports-publish-input').hide();
      this.$el.find('.container-max-restarts-input').hide();
      this.$el.find('.container-network-mode-input').hide();
      this.$el.find('.container-memory-swap-input').hide();
      this.$el.find('.container-hostname-input').hide();
      this.$el.find('.log-config-nav').hide();
      this.$el.find('.storage-nav').hide();
      this.$el.find('.health-nav').hide();
      this.$el.find('.deployment-policy-input').hide();

      this.$el.find('.container-cluster-size-input > label')
          .text(i18n.t('app.container.request.inputs.replicas'));
      this.$el.find('.container-restart-policy-input .form-control').val('always');
      this.commandsEditor.hideButtons();
    }

    this.linksEditor = new MulticolumnInputs(
      this.$el.find('.container-links-input .form-control'), {
        container: enhanceLabels('app.container.request.inputs.linksInputs.service', {
          type: 'dropdown'
        }),
        alias: enhanceLabels('app.container.request.inputs.linksInputs.alias')
      }
    );

    if (this.kubernetes) {
      this.portsEditor = new MulticolumnInputs(
        this.$el.find('.container-ports-input .form-control'), {
          containerPort: enhanceLabels(
            'app.container.request.inputs.portBindingsInputs.containerPort', {
              type: 'number'
            }
          )
        }
      );
    } else {
      this.portsEditor = new MulticolumnInputs(
        this.$el.find('.container-ports-input .form-control'), {
          hostPort: enhanceLabels('app.container.request.inputs.portBindingsInputs.hostPort', {
            type: 'number'
          }),
          containerPort: enhanceLabels(
            'app.container.request.inputs.portBindingsInputs.containerPort', {
              type: 'number'
            }
          )
        }
      );
    }

    this.networksEditor = new MulticolumnInputs(
      this.$el.find('.container-networks-input .form-control'), {
        network: enhanceLabels('app.container.request.inputs.networksInputs.name', {
          type: 'dropdown'
        }),
        aliases: enhanceLabels('app.container.request.inputs.networksInputs.aliases'),
        'ipv4_address': enhanceLabels('app.container.request.inputs.networksInputs.ipv4'),
        'ipv6_address': enhanceLabels('app.container.request.inputs.networksInputs.ipv6')
      }
    );
    this.networksEditor.keepRemovedProperties(false);

    var thatNetworksEditor = this.networksEditor;
    this.networksEditor.$el.on('change', 'select', function() {
      if (this.value === constants.NEW_ITEM_SYSTEM_VALUE) {
        var networks = {};
        thatNetworksEditor.getData().forEach(function(o) {
          networks[o.network] = toNetworkModel(o);
        });

        TemplateActions.openEditNetwork(networks);
      }
    });

    this.volumesEditor = new MulticolumnInputs(
      this.$el.find('.container-volumes-input .form-control'), {
        host: enhanceLabels('app.container.request.inputs.volumesInputs.host'),
        container: enhanceLabels('app.container.request.inputs.volumesInputs.container'),
        readOnly: enhanceLabels('app.container.request.inputs.volumesInputs.readOnly', {
          type: 'checkbox'
        })
      }
    );

    this.volumesFromEditor = new MulticolumnInputs(
      this.$el.find('.container-volumes-from-input .form-control'), {
        volume: enhanceLabels('app.container.request.inputs.volumesFromInputs.volume', {
          type: 'dropdown'
        })
      }
    );

    this.affinityConstraintsEditor = new MulticolumnInputs(
      this.$el.find('.container-affinity-constraints-input .form-control'), {
        antiaffinity: enhanceLabels('app.container.request.inputs.affinityInputs.antiaffinity', {
          type: 'checkbox'
        }),
        servicename: enhanceLabels('app.container.request.inputs.affinityInputs.servicename', {
          type: 'dropdown'
        }),
        constraint: enhanceLabels('app.container.request.inputs.affinityInputs.constraint', {
          type: 'dropdown',
          options: [{
            value: 'soft',
            label: 'soft'
          }, {
            value: 'hard',
            label: 'hard'
          }]
        })
      }
    );

    this.environmentEditor = new MulticolumnInputs(
      this.$el.find('.container-environment-input .form-control'), {
        name: enhanceLabels('app.container.request.inputs.environmentVariablesInputs.name'),
        value: enhanceLabels('app.container.request.inputs.environmentVariablesInputs.value')
      }
    );

    this.customPropertiesEditor = new MulticolumnInputs(
      this.$el.find('.container-custom-properties-input .form-control'), {
        name: enhanceLabels('customProperties.name'),
        value: enhanceLabels('customProperties.value')
      }
    );

    this.customPropertiesEditor.setVisibilityFilter(utils.shouldHideCustomProperty);

    this.$el.find('.container-health-protocol-input #health-none').prop('checked', true);

    var that = this;
    this.$el.find('.container-health-protocol-input input').change(function() {
      healthConfigModeChanged(that.$el, this.value);
    });

    this.$el.find('.health-ignore-on-provision-input .checkbox-control').prop('checked', true);

    this.logConfigOptionsEditor = new MulticolumnInputs(
      this.$el.find('.container-logconfig-options-input .form-control'), {
        name: enhanceLabels('app.container.request.inputs.logConfigOptionsInputs.name'),
        value: enhanceLabels('app.container.request.inputs.logConfigOptionsInputs.value')
      }
    );

    var $networks = this.$el.find('.container-networks-input');
    var $networkMode = this.$el.find('.container-network-mode-input');

    $networkMode.removeClass('hide');
    $networks.addClass('hide');

    healthConfigModeChanged(this.$el, 'NONE');

    this.$el.find('.container-ports-publish-input .checkbox-control')
      .prop('checked', true);

    if (!ft.isDeploymentPoliciesEnabled()) {
      this.$el.find('.deployment-policy-input').hide();
    }

    this.$el.find('.nav-item a[href="#basic"]').tab('show');
    this.$el.find('#basic.tab-pane').addClass('active');
  }

  setData(data) {
    if (this.data !== data) {
      updateForm.call(this, data, this.data || {});

      this.data = data;
    }
  }

  getEl() {
    return this.$el;
  }

  getRawInput() {
    var result = {};

    result.image = this.$imageSearch.typeahead('val');
    var tag = this.$imageTags.typeahead('val');
    if (tag) {
      result.image += ':' + tag;
    }
    result.name = validator.trim(this.$el.find('.container-name-input .form-control').val());
    result.command = this.commandsEditor.getData();
    result.links = this.linksEditor.getData();
    result.deploymentPolicyId = this.$el.find('.deployment-policy-input .form-control').val();
    result.portBindings = this.portsEditor.getData();
    result.publishAll = this.$el.find('.container-ports-publish-input .checkbox-control')
      .is(':checked');
    result.hostname = validator.trim(this.$el.find('.container-hostname-input .form-control').val())
      || null;

    var $networkMode = this.$el.find('.container-network-mode-input');

    result.networkMode = $networkMode.find('.form-control').val() || null;
    var $networks = this.$el.find('.container-networks-input');
    if (!$networks.hasClass('hide')) {
      result.networks = this.networksEditor.getData();
    }

    result.volumes = this.volumesEditor.getData();
    result.volumesFrom = this.volumesFromEditor.getData();
    result.workingDir =
      validator.trim(this.$el.find('.container-working-directory-input .form-control').val())
      || null;
    result._cluster = this.$el.find('.container-cluster-size-input .form-control').val() || 1;
    result.restartPolicy = this.$el.find('.container-restart-policy-input .form-control').val() ||
      null;
    result.maximumRetryCount = this.$el.find('.container-max-restarts-input .form-control').val() ||
      null;
    result.cpuShares = this.$el.find('.container-cpu-shares-input .form-control').val() || null;
    var memoryLimitVal = this.$el.find('.container-memory-limit-input input').val() ||
      null;
    var memoryLimitUnit = this.$el.find('.container-memory-limit-input select').val() ||
      null;
    result.memoryLimit = null;
    if ($.isNumeric(memoryLimitVal)) {
      result.memoryLimit = formatUtils.toBytes(memoryLimitVal, memoryLimitUnit);
    }
    var memorySwapLimitVal = this.$el.find('.container-memory-swap-input input').val() ||
      null;
    var memorySwapLimitUnit = this.$el.find('.container-memory-swap-input select').val() ||
      null;
    result.memorySwapLimit = null;
    if ($.isNumeric(memorySwapLimitVal)) {
      result.memorySwapLimit = formatUtils.toBytes(memorySwapLimitVal, memorySwapLimitUnit);
    }
    result.affinity = this.affinityConstraintsEditor.getData();
    result.env = this.environmentEditor.getData();
    result.customProperties = this.customPropertiesEditor.getData();

    var healthConfig = {};
    healthConfig.protocol = this.$el.find(
      '.container-health-protocol-input input:radio:checked').val();
    healthConfig.ignoreOnProvision =
        this.$el.find('.health-ignore-on-provision-input .checkbox-control').is(':checked');
    healthConfig.autoredeploy = this.$el.find('.container-autoredeployment-input .checkbox-control')
      .is(':checked');
    if (healthConfig.protocol === 'COMMAND') {
      healthConfig.command = this.$el.find('.container-health-command-input textarea').val();
    } else if (healthConfig.protocol !== 'NONE') {
      if (healthConfig.protocol === 'HTTP') {
        healthConfig.urlPath = this.$el.find('.container-health-path-input input').val();
        healthConfig.httpMethod = this.$el.find('.container-health-path-input select')[0].value;
        healthConfig.httpVersion = this.$el.find('.container-health-path-input select')[1].value;
      }
      healthConfig.timeoutMillis =
        this.$el.find('.container-health-timeout-input input')[0].valueAsNumber;
      healthConfig.port = this.$el.find('.container-health-port-input input')[0].valueAsNumber;
      healthConfig.healthyThreshold =
        this.$el.find('.container-healthy-threshold-input input')[0].valueAsNumber;
      healthConfig.unhealthyThreshold =
        this.$el.find('.container-unhealthy-threshold-input input')[0].valueAsNumber;
    } else {
      healthConfig = {};
    }

    result.healthConfig = healthConfig;

    result.logConfig = {};
    result.logConfig.type = this.$el.find('.container-logconfig-driver-input .form-control')
      .val() || null;
    result.logConfig.config = this.logConfigOptionsEditor.getData();
    return result;
  }

  /* convert a raw input object to DTO or read it from view */
  getContainerDescription(rawInput) {
    var result = rawInput || this.getRawInput();

    var currentData = this.data || {};

    // If data was set use the noneditable values
    result.documentId = currentData.documentId;
    result.documentSelfLink = currentData.documentSelfLink;

    if (currentData.healthConfig) {
      result.healthConfig.documentSelfLink = currentData.healthConfig.documentSelfLink;
    }

    var commands = [];
    result.command.forEach(function(o) {
      commands.push(o.command);
    });
    result.command = commands;

    var links = [];
    result.links.forEach(function(o) {
      if (o.alias !== '__null') {
        links.push(o.container + (o.alias ? ':' + o.alias : ''));
      }
    });
    result.links = links;

    var portBindings = [];
    result.portBindings.forEach(function(o) {
      if (o.containerPort !== '__null') {
        portBindings.push({
          hostPort: o.hostPort,
          containerPort: o.containerPort
          });
      }
    });
    result.portBindings = portBindings;

    var networks = {};
    if (result.networks) {
      result.networks.forEach(function(o) {
        networks[o.network] = toNetworkModel(o);
      });
    }
    result.networks = networks;

    var volumes = [];
    result.volumes.forEach(function(o) {
      if (o.container) {
        var volume = o.container;
        if (o.host) {
          volume = o.host + ':' + volume;
        }
        if (o.readOnly) {
          volume += ':ro';
        }
        volumes.push(volume);
      }
    });
    result.volumes = volumes;

    var volumesFrom = [];
    result.volumesFrom.forEach(function(o) {
      volumesFrom.push(o.volume);
    });
    result.volumesFrom = volumesFrom;

    var affinity = [];
    result.affinity.forEach(function(o) {
      var antiaffinity = o.antiaffinity ? '!' : '';
      var prop = antiaffinity + o.servicename;
      if (o.constraint) {
        prop += ':' + o.constraint;
      }
      if (o.servicename !== '__null') {
        affinity.push(prop);
      }
    });
    result.affinity = affinity;

    var env = [];
    result.env.forEach(function(o) {
      if (o.value !== null) {
        env.push(o.name + '=' + o.value);
      }
    });
    result.env = env;

    result.customProperties = utils.arrayToObject(result.customProperties);
    result.logConfig.config = utils.arrayToObject(result.logConfig.config);

    return result;
  }

  validate() {
    /* we need 1:1 relation between input fields and input data to do proper validation */
    this.removeEmptyProperties();
    var rawInput = this.getRawInput();
    var validationErrors = utils.validate(
      rawInput, definitionFormUtils.containerDescriptionConstraints());

    return validationErrors;
  }

  applyValidationErrors(errors) {
    errors = errors || {};

    var image = this.$el.find('.container-image-input');
    utils.applyValidationError(image, errors.image);

    var name = this.$el.find('.container-name-input');
    utils.applyValidationError(name, errors.name);

    var linkProps = $(this.$el).find('.container-links-input');
    utils.applyMultilineValidationError(linkProps, errors.links);

    var portBindings = this.$el.find('.container-ports-input');
    utils.applyMultilineValidationError(portBindings, errors.portBindings);

    var networks = this.$el.find('.container-networks-input');
    utils.applyMultilineValidationError(networks, errors.networks);

    var volumes = this.$el.find('.container-volumes-input');
    utils.applyMultilineValidationError(volumes, errors.volumes);

    var cluster = this.$el.find('.container-cluster-size-input');
    utils.applyValidationError(cluster, errors._cluster);

    var maxRestarts = $(this.$el).find('.container-max-restarts-input');
    utils.applyValidationError(maxRestarts, errors.maximumRetryCount);

    var cpuShares = $(this.$el).find('.container-cpu-shares-input');
    utils.applyValidationError(cpuShares, errors.cpuShares);

    var memLimitVal = $(this.$el).find('.container-memory-limit-input');
    utils.applyValidationError(memLimitVal, errors.memoryLimit);

    var memSwapLimitVal = $(this.$el).find('.container-memory-swap-input');
    utils.applyValidationError(memSwapLimitVal, errors.memorySwapLimit);

    var affinityProps = $(this.$el).find('.container-affinity-constraints-input');
    utils.applyMultilineValidationError(affinityProps, errors.affinity);

    var envVars = $(this.$el).find('.container-environment-input');
    utils.applyMultilineValidationError(envVars, errors.env);

    var custProps = $(this.$el).find('.container-custom-properties-input');
    utils.applyMultilineValidationError(custProps, errors.customProperties);

    var healthErrors = errors.healthConfig || {};

    var healthPath = this.$el.find('.container-health-path-input');
    utils.applyValidationError(healthPath, healthErrors.urlPath);

    var healthPort = this.$el.find('.container-health-port-input');
    utils.applyValidationError(healthPort, healthErrors.port);

    var healthTimeout = this.$el.find('.container-health-timeout-input');
    utils.applyValidationError(healthTimeout, healthErrors.timeoutMillis);

    var healthyThreshold = this.$el.find('.container-healthy-threshold-input');
    utils.applyValidationError(healthyThreshold, healthErrors.healthyThreshold);

    var unhealthyThreshold = this.$el.find('.container-unhealthy-threshold-input');
    utils.applyValidationError(unhealthyThreshold, healthErrors.unhealthyThreshold);

    var logConfigOptions = $(this.$el).find('.container-logconfig-options-input');
    utils.applyMultilineValidationError(logConfigOptions, errors.logConfig);

    this.switchTabs(errors);
  }

  switchTabs(errors) {
    var tabsToActivate = [];

    var fillTabsToActivate = ($el) => {
      let tabId = this.getTabId($el);
      if (tabsToActivate.indexOf(tabId) === -1) {
        tabsToActivate.push(tabId);
      }
    };

    // TODO: simplify this, so that we can map error to input, on a lot of places it is needed
    if (errors.image) {
      fillTabsToActivate(this.$el.find('.container-image-input'));
    }
    if (errors.name) {
      fillTabsToActivate(this.$el.find('.container-name-input'));
    }
    if (errors.links) {
      fillTabsToActivate(this.linksEditor.$el);
    }
    if (errors.portBindings) {
      fillTabsToActivate(this.portsEditor.$el);
    }
    if (errors.networks) {
      fillTabsToActivate(this.networksEditor.$el);
    }
    if (errors._cluster) {
      fillTabsToActivate(this.$el.find('.container-cluster-size-input'));
    }
    if (errors.maximumRetryCount) {
      fillTabsToActivate(this.$el.find('.container-max-restarts-input'));
    }
    if (errors.cpuShares) {
      fillTabsToActivate(this.$el.find('.container-cpu-shares-input'));
    }
    if (errors.memoryLimit) {
      fillTabsToActivate(this.$el.find('.container-memory-limit-input'));
    }
    if (errors.memorySwapLimit) {
      fillTabsToActivate(this.$el.find('.container-memory-swap-input'));
    }
    if (errors.affinity) {
      fillTabsToActivate(this.affinityConstraintsEditor.$el);
    }
    if (errors.env) {
      fillTabsToActivate(this.environmentEditor.$el);
    }
    if (errors.customProperties) {
      fillTabsToActivate(this.customPropertiesEditor.$el);
    }
    if (errors.healthConfig) {
      fillTabsToActivate(this.$el.find('.container-health-port-input'));
    }
    if (errors.logConfig) {
      fillTabsToActivate(this.logConfigOptionsEditor.$el);
    }

    var activeTabId = this.getActiveTabId();
    if (tabsToActivate.length > 0 && (!activeTabId || tabsToActivate.indexOf(activeTabId) === -1)) {
      this.activateTab(tabsToActivate[0]);
    }
  }

  getTabId($inputEl) {
    return $inputEl.closest('.tab-pane').attr('id');
  }

  getActiveTabId() {
    return $(this.$el).find('.container-form-content .tab-content .tab-pane.active').attr('id');
  }

  activateTab(tabId) {
    $(this.$el).find('.container-form-content .nav a[href="#' + tabId + '"]').tab('show');
  }

  removeEmptyProperties() {
    for (var key in this) {
      if (this.hasOwnProperty(key)) {
        if (this[key] instanceof MulticolumnInputs) {
          this[key].removeEmptyProperties();
        }
      }
    }
  }
}

var updateForm = function(data, oldData) {
  if (utils.hasChanged(data.image, oldData.image)) {
    var tag = imageUtils.getImageTag(data.image);
    if (tag) {
      this.$imageSearch.typeahead('val', data.image.slice(0, data.image.lastIndexOf(':')));
      this.$imageTags.typeahead('val', tag);
    } else {
      this.$imageSearch.typeahead('val', data.image);
    }

    definitionFormUtils.loadTags(this.$tagsHolder, data.image, tag);
  }

  if (utils.hasChanged(data.name, oldData.name)) {
    this.$el.find('.container-name-input .form-control').val(data.name);
  }

  if (utils.hasChanged(data.command, oldData.command)) {
    var commands = [];
    if (data.command) {
      data.command.forEach(function(o) {
        commands.push({
          command: o
        });
      });
    }

    this.commandsEditor.setData(commands);
  }

  if (utils.hasChanged(data.otherContainers, oldData.otherContainers)) {
    var options = [];
    if (data.otherContainers) {
      data.otherContainers.forEach(function(o) {
        options.push({
          label: o.name,
          value: o.name
        });
      });
    } else {
      this.$el.find('.container-links-input').hide();
      this.$el.find('.container-volumes-from-input').hide();
      this.$el.find('.container-affinity-constraints-input').hide();
    }
    this.linksEditor.setOptions({container: options});
    this.volumesFromEditor.setOptions({volume: options});
    this.affinityConstraintsEditor.setOptions({servicename: options});
  }

  if (utils.hasChanged(data.availableNetworks, oldData.availableNetworks)) {
    var availableNetworks = [];
    if (data.availableNetworks) {
      data.availableNetworks.forEach(function(o) {
        availableNetworks.push({
          label: o.label || o.name,
          value: o.name
        });
      });

      availableNetworks.push({
        label: i18n.t('app.template.details.editNetwork.newDropdownTitle'),
        value: constants.NEW_ITEM_SYSTEM_VALUE
      });
    }
    this.networksEditor.setOptions({network: availableNetworks});
  }

  if (utils.hasChanged(data.links, oldData.links)) {
    var links = [];
    if (data.links) {
      data.links.forEach(function(o) {
        var linkSplit = o.split(':');
        links.push({
          container: linkSplit[0],
          alias: linkSplit[1]
        });
      });
    }

    this.linksEditor.setData(links);
  }

  if (utils.hasChanged(data.portBindings, oldData.portBindings)) {
    var portBindings = [];
    if (data.portBindings) {
      data.portBindings.forEach(function(pb) {
        portBindings.push({
          hostPort: pb.hostPort,
          containerPort: pb.containerPort
        });
      });
    }

    this.portsEditor.setData(portBindings);
  }

  if (utils.hasChanged(data.publishAll, oldData.publishAll)) {
    this.$el.find('.container-ports-publish-input .checkbox-control')
      .prop('checked', !!data.publishAll);
  }

  if (utils.hasChanged(data.hostname, oldData.hostname)) {
    this.$el.find('.container-hostname-input .form-control').val(data.hostname);
  }

  if (utils.hasChanged(data.deploymentPolicies, oldData.deploymentPolicies)) {
    $('.deployment-policy-input .form-control').empty();
    $('.deployment-policy-input .form-control').append(new Option());
    if (data.deploymentPolicies) {
      for (let item in data.deploymentPolicies) {
        if (data.deploymentPolicies.hasOwnProperty(item)) {
          let policy = data.deploymentPolicies[item];
          let option = new Option(policy.name, utils.getDocumentId(policy.documentSelfLink));
          $('.deployment-policy-input .form-control').append(option);
        }
      }
    }
  }

  if (utils.hasChanged(data.deploymentPolicyId, oldData.deploymentPolicyId)) {
    this.$el.find('.deployment-policy-input .form-control').val(data.deploymentPolicyId);
  }

  var $networkMode = this.$el.find('.container-network-mode-input');

  if (utils.hasChanged(data.availableNetworks, oldData.availableNetworks)) {
    var $networks = this.$el.find('.container-networks-input');
    if (data.availableNetworks) {
      $networks.removeClass('hide');
    } else {
      $networks.addClass('hide');
    }
  }

  if (utils.hasChanged(data.networks, oldData.networks)) {
    var networks = [];
    if (data.networks) {
      for (var key in data.networks) {
        if (data.networks.hasOwnProperty(key)) {
          var viewModel = fromNetworkModel(data.networks[key]);
          viewModel.network = key;
          networks.push(viewModel);
        }
      }
    }
    this.networksEditor.setData(networks);
  }

  if (utils.hasChanged(data.networkMode, oldData.networkMode)) {
    if (data.networkMode === '' || data.networkMode) {
      $networkMode.find('.form-control').val(data.networkMode);
    }
  }

  if (utils.hasChanged(data.volumes, oldData.volumes)) {
    var volumes = [];
    if (data.volumes) {
      data.volumes.forEach(function(vol) {
        var src = '', dst, mode = 'rw';

        var volSplit = vol.split(':');
        if (volSplit.length === 1) {
          dst = volSplit[0];
        } else if (volSplit.length === 2) {
          if (volSplit[1] === 'ro') {
            dst = volSplit[0];
            mode = volSplit[1];
          } else {
            src = volSplit[0];
            dst = volSplit[1];
          }
        } else {
          src = volSplit[0];
          dst = volSplit[1];
          mode = volSplit[2];
        }

        volumes.push({
          host: src,
          container: dst,
          readOnly: mode === 'ro'
        });
      });
    }

    this.volumesEditor.setData(volumes);
  }

  if (utils.hasChanged(data.volumesFrom, oldData.volumesFrom)) {
    var volumesFrom = [];
    if (data.volumesFrom) {
      data.volumesFrom.forEach(function(v) {
        volumesFrom.push({
          volume: v
        });
      });
    }

    this.volumesFromEditor.setData(volumesFrom);
  }

  if (utils.hasChanged(data.workingDir, oldData.workingDir)) {
    this.$el.find('.container-working-directory-input .form-control').val(data.workingDir);
  }
  if (utils.hasChanged(data._cluster, oldData._cluster)) {
    this.$el.find('.container-cluster-size-input .form-control').val(data._cluster);
  }
  if (utils.hasChanged(data.restartPolicy, oldData.restartPolicy)) {
    if (data.restartPolicy) {
      this.$el.find('.container-restart-policy-input .form-control').val(data.restartPolicy);
    }
  }
  if (utils.hasChanged(data.maximumRetryCount, oldData.maximumRetryCount)) {
    this.$el.find('.container-max-restarts-input .form-control').val(data.maximumRetryCount);
  }
  if (utils.hasChanged(data.cpuShares, oldData.cpuShares)) {
    this.$el.find('.container-cpu-shares-input .form-control').val(data.cpuShares);
  }

  if (utils.hasChanged(data.memoryLimit, oldData.memoryLimit)) {
    if ($.isNumeric(data.memoryLimit)) {
      let size = formatUtils.fromBytes(data.memoryLimit);
      normalizeToKB(size);
      this.$el.find('.container-memory-limit-input input').val(size.value);
      this.$el.find('.container-memory-limit-input select').val(size.unit);
    } else {
      this.$el.find('.container-memory-limit-input input').val('');
      this.$el.find('.container-memory-limit-input select').val('MB');
    }
  }

  if (utils.hasChanged(data.memorySwapLimit, oldData.memorySwapLimit)) {
    if ($.isNumeric(data.memorySwapLimit)) {
      let size = formatUtils.fromBytes(data.memorySwapLimit);
      normalizeToKB(size);
      this.$el.find('.container-memory-swap-input input').val(size.value);
      this.$el.find('.container-memory-swap-input select').val(size.unit);
    } else {
      this.$el.find('.container-memory-swap-input input').val('');
      this.$el.find('.container-memory-swap-input select').val('MB');
    }
  }

  if (utils.hasChanged(data.healthConfig, oldData.healthConfig)) {
    if (data.healthConfig) {
      let protocol = data.healthConfig.protocol;

      this.$el.find('.health-ignore-on-provision-input .checkbox-control')
        .prop('checked', !!data.healthConfig.ignoreOnProvision);
      this.$el.find('.container-autoredeployment-input .checkbox-control')
        .prop('checked', !!data.healthConfig.autoredeploy);
      this.$el.find('.container-health-protocol-input input[value='
                    + protocol + ']').prop('checked', true);
      healthConfigModeChanged(this.$el, protocol);

      if (protocol === 'COMMAND') {
        this.$el.find('.container-health-command-input textarea').val(data.healthConfig.command);
      } else {
        this.$el.find('.container-health-timeout-input input').val(data.healthConfig.timeoutMillis);
        this.$el.find('.container-health-port-input input').val(data.healthConfig.port);
        this.$el.find('.container-healthy-threshold-input input')
          .val(data.healthConfig.healthyThreshold);
        this.$el.find('.container-unhealthy-threshold-input input')
          .val(data.healthConfig.unhealthyThreshold);

        if (protocol === 'HTTP') {
          this.$el.find('.container-health-path-input input').val(data.healthConfig.urlPath);
          this.$el.find('.container-health-path-input select')[0].value
                                               = data.healthConfig.httpMethod;
          this.$el.find('.container-health-path-input select')[1].value
                                               = data.healthConfig.httpVersion;
        }
      }
    } else {
      healthConfigModeChanged(this.$el, 'NONE');
    }
  }

  if (utils.hasChanged(data.affinity, oldData.affinity)) {
    var affinity = [];
    if (data.affinity) {
      data.affinity.forEach(function(c) {
        var antiaffinity = c[0] === '!';
        if (antiaffinity) {
          c = c.slice(1);
        }
        var affinitySplit = c.split(':');
        affinity.push({
          antiaffinity: antiaffinity,
          servicename: affinitySplit[0],
          constraint: affinitySplit[1]
        });
      });
    }

    this.affinityConstraintsEditor.setData(affinity);
  }

  if (utils.hasChanged(data.env, oldData.env)) {
    var env = [];
    if (data.env) {
      data.env.forEach(function(e) {
        var index = e.indexOf('=');
        env.push({
          name: e.substring(0, index),
          value: e.substring(index + 1)
        });
      });
    }

    this.environmentEditor.setData(env);
  }

  if (utils.hasChanged(data.customProperties, oldData.customProperties)) {
    var customProperties = utils.objectToArray(data.customProperties);

    this.customPropertiesEditor.setData(customProperties);
  }

  if (utils.hasChanged(data.logConfig, oldData.logConfig)) {
    if (data.logConfig) {
      this.$el.find('.container-logconfig-driver-input .form-control').val(data.logConfig.type);
      var logConfigOptions = utils.objectToArray(data.logConfig.config);
      this.logConfigOptionsEditor.setData(logConfigOptions);
    }
  }
};

function enhanceLabels(baseLabelPath, baseObject) {
  if (!baseObject) {
    baseObject = {};
  }
  if (baseLabelPath) {
    baseObject.header = i18n.t(baseLabelPath);
    baseObject.placeholder = i18n.t(baseLabelPath + 'Hint', {defaultValue: ''});
  }
  return baseObject;
}

function healthConfigModeChanged($el, mode) {
  if (mode === 'HTTP') {
      $el.find('#health-config').show();
      $el.find('.container-health-path-input').show();
      $el.find('#health-config-command').hide();
      $el.find('.health-ignore-on-provision-input').show();
      $el.find('.container-autoredeployment-input').show();
    } else if (mode === 'TCP') {
      $el.find('#health-config').show();
      $el.find('.container-health-path-input').hide();
      $el.find('#health-config-command').hide();
      $el.find('.health-ignore-on-provision-input').show();
      $el.find('.container-autoredeployment-input').show();
    } else if (mode === 'NONE') {
      $el.find('#health-config').hide();
      $el.find('#health-config-command').hide();
      $el.find('.health-ignore-on-provision-input').hide();
      $el.find('.container-autoredeployment-input').hide();
    } else if (mode === 'COMMAND') {
      $el.find('#health-config-command').show();
      $el.find('#health-config').hide();
      $el.find('.health-ignore-on-provision-input').show();
      $el.find('.container-autoredeployment-input').show();
    }

    if (utils.isApplicationEmbedded()) {
      $el.find('.container-autoredeployment-input').hide();
    }
}

var normalizeToKB = function(size) {
  if (size.unit === 'Bytes') {
    size.value /= 1024;
    size.unit = 'kB';
  }
};

var toNetworkModel = function(viewModel) {
  var result = {};
  if (viewModel.aliases) {
    result.aliases = viewModel.aliases.split(',').map(a => a.trim());
  }

  if (viewModel.ipv4_address) {
    result.ipv4_address = viewModel.ipv4_address;
  }

  if (viewModel.ipv6_address) {
    result.ipv6_address = viewModel.ipv6_address;
  }

  return result;
};

var fromNetworkModel = function(netModel) {
  var result = {};
  if (netModel.aliases) {
    result.aliases = netModel.aliases.join(', ');
  }

  if (netModel.ipv4_address) {
    result.ipv4_address = netModel.ipv4_address;
  }

  if (netModel.ipv6_address) {
    result.ipv6_address = netModel.ipv6_address;
  }

  return result;
};

export default ContainerDefinitionForm;
