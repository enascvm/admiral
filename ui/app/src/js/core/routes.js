/*
 * Copyright (c) 2016-2017 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

import * as actions from 'actions/Actions';
import modal from 'core/modal';
import constants from 'core/constants';
import utils from 'core/utils';
import docs from 'core/docs';

crossroads.addRoute('/', function() {
    hasher.setHash('home');
});

crossroads.addRoute('/home', function() {
 actions.AppActions.openHome();
});

crossroads.addRoute('/closures/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CLOSURES.name);
  actions.ContainerActions.openContainers({
    '$category': 'closures'
  }, true);
  actions.ContainerActions.openCreateClosure();
});

crossroads.addRoute('/projects:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.PROJECTS.name);

  query = query || {};
  query.$category = 'projects';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/applications:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.APPLICATIONS.name);

  query = query || {};
  query.$category = 'applications';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/networks:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.NETWORKS.name);

  query = query || {};
  query.$category = 'networks';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/volumes:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.VOLUMES.name);

  query = query || {};
  query.$category = 'volumes';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/kubernetes:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.KUBERNETES.name);

  query = query || {};
  query.$category = 'kubernetes';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/closures', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CLOSURES.name);
  actions.ContainerActions.openContainers({
    '$category': 'closures'
  }, true, true);
});

crossroads.addRoute('/closures:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CLOSURES.name);

  query = query || {};
  query.$category = 'closures';
  actions.ContainerActions.openContainers(query, true, true);
});

crossroads.addRoute('/templates:?query:', function(query) {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openTemplates(query, true);
});

crossroads.addRoute('/templates/image/{imageId*}/newContainer', function(imageId) {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openTemplates();
  actions.TemplateActions.openContainerRequest(constants.TEMPLATES.TYPES.IMAGE, imageId);
});

crossroads.addRoute('/templates/template/{templateId*}', function(templateId) {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openTemplates();
  actions.TemplateActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE, templateId);
});

crossroads.addRoute('/templates/template/{templateId*}/newContainer', function(templateId) {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openTemplates();
  actions.TemplateActions.openContainerRequest(constants.TEMPLATES.TYPES.TEMPLATE, templateId);
});

crossroads.addRoute('/registries', function() {
  actions.AppActions.openView(constants.VIEWS.REGISTRIES.name);
  actions.RegistryActions.openRegistries();
});

crossroads.addRoute('/credentials', function() {
  actions.AppActions.openView(constants.VIEWS.CREDENTIALS.name);
  actions.CredentialsActions.retrieveCredentials();
});

crossroads.addRoute('/certificates', function() {
  actions.AppActions.openView(constants.VIEWS.CERTIFICATES.name);
  actions.CertificatesActions.retrieveCertificates();
});

crossroads.addRoute('/import-template', function() {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openImportTemplate();
});

crossroads.addRoute('/containers:?query:', function(query) {
  let viewName = constants.VIEWS.RESOURCES.VIEWS.CONTAINERS.name;

  actions.AppActions.openView(viewName);

  query = query || {};
  query.$category = 'containers';
  actions.ContainerActions.openContainers(query, true);
});

crossroads.addRoute('/containers/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CONTAINERS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openCreateContainer();
});

crossroads.addRoute('/applications/new', function() {
  actions.AppActions.openView(constants.VIEWS.TEMPLATES.name);
  actions.TemplateActions.openTemplates({}, true);
  actions.TemplateActions.openCreateNewTemplate('applications');
});

crossroads.addRoute('/projects/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.PROJECTS.name);
  actions.ContainerActions.openContainers({
    '$category': 'projects'
  }, true);
  actions.ResourceGroupsActions.openCreateOrEditProject();
});

crossroads.addRoute('/networks/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.NETWORKS.name);
  actions.ContainerActions.openContainers({
    '$category': 'networks'
  }, true);
  actions.ContainerActions.openCreateNetwork();
});

crossroads.addRoute('/volumes/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.VOLUMES.name);
  actions.ContainerActions.openContainers({
    '$category': 'volumes'
  }, true);
  actions.VolumeActions.openCreateVolume();
});

crossroads.addRoute('/kubernetes/new', function() {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.KUBERNETES.name);
  actions.ContainerActions.openContainers({
    '$category': 'kubernetes'
  }, true);
  actions.KubernetesActions.openCreateKubernetesEntities();
});

crossroads.addRoute('containers/composite/{compositeComponentId*}' +
                    '/cluster/{clusterId*}/containers/{childContainerId*}',
                    function(compositeComponentId, clusterId, childContainerId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.APPLICATIONS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openContainerDetails(childContainerId, clusterId, compositeComponentId);
});

crossroads.addRoute('containers/composite/{compositeComponentId*}/containers/{childContainerId*}',
                    function(compositeComponentId, childContainerId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.APPLICATIONS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openContainerDetails(childContainerId, null, compositeComponentId);
});

crossroads.addRoute('containers/composite/{compositeComponentId*}/cluster/{clusterId*}',
                    function(compositeComponentId, clusterId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.APPLICATIONS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openClusterDetails(clusterId, compositeComponentId);
});

crossroads.addRoute('containers/composite/{compositeComponentId*}', function(compositeComponentId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.APPLICATIONS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openCompositeContainerDetails(compositeComponentId);
});

crossroads.addRoute('closures/{closureDescriptionId*}', function(closureDescriptionId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CLOSURES.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openCompositeClosureDetails(closureDescriptionId);
});

crossroads.addRoute('/containers/{containerId*}', function(containerId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CONTAINERS.name);
  actions.ContainerActions.openContainers();
  actions.ContainerActions.openContainerDetails(containerId);
});

crossroads.addRoute('/closure/{closureId*}', function(closureId) {
  actions.AppActions.openView(constants.VIEWS.RESOURCES.VIEWS.CLOSURES.name);
  actions.ContainerActions.openClosureDetails(closureId);
});

function addNgRoute(route, view) {
  crossroads.addRoute(route, () => {
    actions.AppActions.openView(view.name, routes.getHash());
  });
}

const K8SViews = constants.VIEWS.KUBERNETES_RESOURCES.VIEWS;
addNgRoute('/kubernetes/pods/:query*:', K8SViews.PODS);
addNgRoute('/kubernetes/services/:query*:', K8SViews.SERVICES);
addNgRoute('/kubernetes/deployments/:query*:', K8SViews.DEPLOYMENTS);
addNgRoute('/kubernetes/replication-controllers/:query*:', K8SViews.REPLICATION_CONTROLLERS);
addNgRoute('/kubernetes/applications/:query*:', K8SViews.APPLICATIONS);

// Nothing from the above is matched, redirect to main
crossroads.bypassed.add(function() {
  hasher.setHash('');
});

actions.NavigationActions.openHome.listen(function() {
  hasher.setHash('home');
});

actions.NavigationActions.openHosts.listen(function(queryOptions) {
  hasher.setHash(getHashWithQuery('hosts', queryOptions));
});

actions.NavigationActions.openTemplates.listen(function(queryOptions) {
  hasher.setHash(getHashWithQuery('templates', queryOptions));
});

actions.NavigationActions.openRegistries.listen(function() {
  hasher.setHash('registries');
});

actions.NavigationActions.openTemplateDetails.listen(function(type, itemId) {
  if (type === constants.TEMPLATES.TYPES.TEMPLATE) {
    hasher.setHash('templates/template/' + itemId);
  } else {
    hasher.setHash('templates/image/' + itemId);
  }
});

actions.NavigationActions.openContainerRequest.listen(function(type, itemId) {
  if (type === constants.TEMPLATES.TYPES.TEMPLATE) {
    hasher.setHash('templates/template/' + itemId + '/newContainer');
  } else {
    hasher.setHash('templates/image/' + itemId + '/newContainer');
  }
});

actions.NavigationActions.openContainers.listen(function(queryOptions) {
  var category;
  if (queryOptions) {
    category = queryOptions.$category;
    queryOptions = $.extend({}, queryOptions);
    delete queryOptions.$category;
  }

  category = category || constants.CONTAINERS.SEARCH_CATEGORY.CONTAINERS;
  hasher.setHash(getHashWithQuery(category, queryOptions));
});

actions.NavigationActions.openNetworks.listen(function(queryOptions) {
  var category;
  if (queryOptions) {
    category = queryOptions.$category;
    queryOptions = $.extend({}, queryOptions);
    delete queryOptions.$category;
  }

  category = category || constants.CONTAINERS.SEARCH_CATEGORY.NETWORKS;
  hasher.setHash(getHashWithQuery(category, queryOptions));
});

actions.NavigationActions.openVolumes.listen(function(queryOptions) {
  var category;
  if (queryOptions) {
    category = queryOptions.$category;
    queryOptions = $.extend({}, queryOptions);
    delete queryOptions.$category;
  }

  category = category || constants.CONTAINERS.SEARCH_CATEGORY.VOLUMES;
  hasher.setHash(getHashWithQuery(category, queryOptions));
});

actions.NavigationActions.openContainerDetails.listen(function(containerId, clusterId,
                                                                compositeComponentId) {
  if (clusterId && compositeComponentId) {
    hasher.setHash('containers/composite/' + compositeComponentId + '/cluster/' + clusterId +
                  '/containers/' + containerId);
  } else if (clusterId) {
    hasher.setHash('containers/cluster/' + clusterId + '/containers/' + containerId);
  } else if (compositeComponentId) {
    hasher.setHash('containers/composite/' + compositeComponentId + '/containers/' + containerId);
  } else {
    hasher.setHash('containers/' + containerId);
  }
});

actions.NavigationActions.openClosureDetails.listen(function(closureId) {
  hasher.setHash('closure/' + closureId);
});

actions.NavigationActions.openClusterDetails.listen(function(clusterId, compositeComponentId) {
  if (compositeComponentId) {
    hasher.setHash('containers/composite/' + compositeComponentId + '/cluster/' + clusterId);
  } else {
    hasher.setHash('containers/cluster/' + clusterId);
  }
});

actions.NavigationActions.openCompositeContainerDetails.listen(function(compositeComponentId) {
  hasher.setHash('containers/composite/' + compositeComponentId);
});

actions.NavigationActions.openCompositeClosureDetails.listen(function(closureDescriptionId) {
  hasher.setHash('closures/' + closureDescriptionId);
});

actions.NavigationActions.openCreateNewContainer.listen(function() {
  hasher.setHash('containers/new');
});

actions.NavigationActions.openCreateNewApplication.listen(function() {
  hasher.setHash('applications/new');
});

actions.NavigationActions.openCreateNewNetwork.listen(function() {
  hasher.setHash('networks/new');
});

actions.NavigationActions.openCreateNewVolume.listen(function() {
  hasher.setHash('volumes/new');
});

actions.NavigationActions.openCreateNewProject.listen(function() {
  hasher.setHash('projects/new');
});

actions.NavigationActions.openCreateNewClosure.listen(function() {
  hasher.setHash('closures/new');
});

actions.NavigationActions.openCreateNewKubernetes.listen(function() {
  hasher.setHash('kubernetes/new');
});

actions.NavigationActions.showContainersPerPlacement.listen(function(placementId) {
  let queryOptions = {
    'placement': placementId
  };

  hasher.setHash(getHashWithQuery('containers', queryOptions));
});

actions.NavigationActions.openPlacements.listen(function() {
  hasher.setHash('placements');
});

actions.NavigationActions.openClosuresSilently.listen(function() {
  hasher.changed.active = false;
  hasher.setHash('closures');
  hasher.changed.active = true;
});

actions.NavigationActions.openClosures.listen(function() {
 hasher.setHash('closures');
});

actions.NavigationActions.openAddClosure.listen(function() {
  hasher.setHash('closures/new');
});

function parseHash(newHash) {
  // In case of any opened modals, through interaction with browser, we should close in any case
  modal.hide();
  crossroads.parse(newHash);

  if (newHash) {
    if (window.notifyNavigation) {
      window.notifyNavigation('/' + newHash);
    }
    docs.update('/' + newHash);
  } else {
    docs.update('/');
  }
}

function getHashWithQuery(hash, queryOptions) {
  var queryString;
  if (queryOptions) {
    queryString = utils.paramsToURI(queryOptions);
  }

  if (queryString) {
    return hash + '?' + queryString;
  } else {
    return hash;
  }
}

var routes = {
  initialize: function() {
    hasher.stop();
    hasher.initialized.add(parseHash); // Parse initial hash
    hasher.changed.add(parseHash); // Parse hash changes
    hasher.init(); // Start listening for history change
  },

  getHash: function() {
    return hasher.getHash();
  },

  getContainersHash: function(queryOptions) {
    return getHashWithQuery('containers', queryOptions);
  }
};

export default routes;
