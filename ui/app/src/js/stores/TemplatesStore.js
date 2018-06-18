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
import services from 'core/services';
import constants from 'core/constants';
import links from 'core/links';
import utils from 'core/utils';
import imageUtils from 'core/imageUtils';
import RegistryStore from 'stores/RegistryStore';
import RequestsStore from 'stores/RequestsStore';
import PlacementsStore from 'stores/PlacementsStore';
import ResourceGroupsStore from 'stores/ResourceGroupsStore';
import NotificationsStore from 'stores/NotificationsStore';
import EventLogStore from 'stores/EventLogStore';
import DeploymentPolicyStore from 'stores/DeploymentPolicyStore';
import ContextPanelStoreMixin from 'stores/mixins/ContextPanelStoreMixin';
import CrudStoreMixin from 'stores/mixins/CrudStoreMixin';
import recommendedImages from 'core/recommendedImages';

const DTO_IMAGE_TYPE = 'CONTAINER_IMAGE_DESCRIPTION';
const DTO_TEMPLATE_TYPE = 'COMPOSITE_DESCRIPTION';

const CHECK_INTERVAL_MS = 1000;

const OPERATION = {
  LIST: 'LIST'
};

let navigateTemplatesAndOpenRequests = function(request) {
  var openTemplatesUnsubscribe = actions.TemplateActions.openTemplates.listen(() => {
    openTemplatesUnsubscribe();
    this.openToolbarItem(constants.CONTEXT_PANEL.REQUESTS, RequestsStore.getData());
    actions.RequestsActions.requestCreated(request);
  });

  actions.NavigationActions.openTemplates();
};

let _enhanceImage = function(image) {
  image.documentId = image.name;
  image.name = imageUtils.getImageName(image.name);
  image.icon = imageUtils.getImageIconLink(image.name);
  image.type = constants.TEMPLATES.TYPES.IMAGE;
};

let _enhanceContainerTemplate = function(containerTemplate, listViewPath) {
  containerTemplate.documentId = utils.getDocumentId(containerTemplate.documentSelfLink);
  containerTemplate.name = containerTemplate.name || containerTemplate.documentId;

  var images = [...new Set(containerTemplate.descriptionImages)];
  containerTemplate.icons = images.map(image => imageUtils.getImageIconLink(image));
  containerTemplate.type = constants.TEMPLATES.TYPES.TEMPLATE;

  services.loadTemplateDescriptionImages(containerTemplate.documentSelfLink).then((result) => {
      let icons = new Set();
      for (let key in result.descriptionImages) {
        if (result.descriptionImages.hasOwnProperty(key)) {
          if (key.indexOf(links.CLOSURE_DESCRIPTIONS) === 0) {
            icons.add(utils.getClosureIcon(result.descriptionImages[key]));
          } else {
            icons.add(imageUtils.getImageIconLink(result.descriptionImages[key]));
          }
        }
      }

      var selector = this.selectFromData(listViewPath);
      let items = selector.getIn('items');
      if (items) {
        items = items.map((t) => {
          if (t.documentSelfLink === containerTemplate.documentSelfLink) {
            t = t.asMutable();
            t.icons = [...icons];
          }
          return t;
        });
        selector.setIn('items', items);
        this.emitChange();
      }
    }).catch((e) => {
      console.warn('Cannot load template description images', e);
    });
};

let _enhanceClosureDescription = function(closure) {
  closure.documentId = closure.documentSelfLink;
  closure.icon = imageUtils.getImageIconLink(closure.name);
  closure.type = constants.TEMPLATES.TYPES.CLOSURE;
};

let _enhanceContainerDescription = function(containerDescription, allContainerDescriptions) {
  let containerDescriptionLink = containerDescription.documentSelfLink;
  if (containerDescriptionLink) {
    containerDescription.documentId = utils.getDocumentId(containerDescriptionLink);
  }

  containerDescription.icon = imageUtils.getImageIconLink(containerDescription.image);

  let resultTemplates = allContainerDescriptions.map((containerDescription) => {
    return {
      id: containerDescription.documentSelfLink,
      name: containerDescription.name
    };
  });

  let otherTemplates = resultTemplates;
  if (containerDescriptionLink) {

    otherTemplates = resultTemplates.filter((template) => {
      return template.id !== containerDescriptionLink;
    });
  }

  containerDescription.otherContainers = otherTemplates;
};

let searchImages = function(queryOptions, searchOnlyImages, forContainerDefinition) {
  var listViewPath;
  if (forContainerDefinition) {
    listViewPath = ['selectedItemDetails', 'newContainerDefinition', 'listView'];
  } else {
    listViewPath = ['listView'];
  }

  var operation = this.requestCancellableOperation(OPERATION.LIST, queryOptions);
  if (!operation) {
    return;
  }

  this.setInData(listViewPath.concat(['itemsLoading']), true);
  this.emitChange();

  if (searchOnlyImages) {
    queryOptions.$category = 'images';
  }

  operation.forPromise(services.loadTemplates(queryOptions)).then((data) => {
    var isPartialResult = data.isPartialResult;
    var templates = data.results;
    var resultTemplates = [];
    for (var i = 0; i < templates.length; i++) {
      var template = templates[i];

      if (template.templateType === DTO_IMAGE_TYPE) {
        _enhanceImage(template);
        resultTemplates.push(template);
      } else if (template.templateType === DTO_TEMPLATE_TYPE) {
        _enhanceContainerTemplate.call(this, template, listViewPath);
        resultTemplates.push(template);
      }
    }

    this.setInData(listViewPath.concat(['items']), resultTemplates);
    this.setInData(listViewPath.concat(['itemsLoading']), false);
    this.setInData(listViewPath.concat(['searchedItems']), true);
    this.setInData(listViewPath.concat(['isPartialResult']), isPartialResult);
    if (isPartialResult) {
      var _this = this;
      setTimeout(function() {
        _this.setInData(listViewPath.concat(['isPartialResult']), false);
        _this.emitChange();
      }, constants.VISUALS.ITEM_HIGHLIGHT_ACTIVE_TIMEOUT_LONG);
    }
    this.emitChange();
  }).catch((e) => {
    this.setInData(listViewPath.concat(['items']), []);
    this.setInData(listViewPath.concat(['itemsLoading']), false);
    this.setInData(listViewPath.concat(['searchedItems']), true);
    this.setInData(listViewPath.concat(['error']), utils.getErrorMessage(e));
    this.emitChange();
  });
};

let processClosures = function(closuresResult) {
  // Transforming from associative array to array
  var closures = [];
  for (var key in closuresResult) {
    if (closuresResult.hasOwnProperty(key)) {
      let closure = closuresResult[key];
      closures.push(closure);
    }
  }

  return closures;
};

let searchClosures = function(queryOptions, searchOnlyImages, forContainerDefinition) {
  var listViewPath;
  if (forContainerDefinition) {
    listViewPath = ['selectedItemDetails', 'newContainerDefinition', 'listView'];
  } else {
    listViewPath = ['listView'];
  }

  var operation = this.requestCancellableOperation(OPERATION.LIST, queryOptions);
  if (!operation) {
    return;
  }

  this.setInData(listViewPath.concat(['itemsLoading']), true);

  this.emitChange();

  operation.forPromise(services.loadTemplateClosures(queryOptions)).then((closuresResult) => {
    var resultTemplates = [];
    if (closuresResult) {
      let closures = processClosures(closuresResult);
      for (var i = 0; i < closures.length; i++) {
        var closure = closures[i];

        _enhanceClosureDescription(closure);
        resultTemplates.push(closure);
      }
    }

    this.setInData(listViewPath.concat(['items']), resultTemplates);
    this.setInData(listViewPath.concat(['itemsLoading']), false);
    this.setInData(listViewPath.concat(['searchedItems']), true);
    this.emitChange();
  }).catch((e) => {
    // Error
    this.setInData(listViewPath.concat(['items']), []);
    this.setInData(listViewPath.concat(['itemsLoading']), false);
    this.setInData(listViewPath.concat(['searchedItems']), true);
    this.setInData(listViewPath.concat(['error']),
      e.responseJSON.message || e.statusText);
    this.emitChange();
  });
};

let loadRecommended = function(forContainerDefinition) {
  var listViewPath;
  if (forContainerDefinition) {
    listViewPath = ['selectedItemDetails', 'newContainerDefinition', 'listView'];
  } else {
    listViewPath = ['listView'];
  }

  this.setInData(listViewPath.concat(['items']), recommendedImages.images);
  this.setInData(listViewPath.concat(['searchedItems']), false);
  this.emitChange();
};

let handlePublishTemplate = function(templateDocumentSelfLink, alertObj) {
  if (this.data.selectedItemDetails) {
    // we are in template details view
    this.setInData(['selectedItemDetails', 'alert'], alertObj);
    this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'itemsLoading'], false);
    this.emitChange();
  } else {
    // we are in main templates view
    var templates = utils.getIn(this.getData(), ['listView', 'items']).asMutable({
      deep: true
    });
    for (let idx = 0; idx < templates.length; idx++) {
      if (templates[idx].documentSelfLink === templateDocumentSelfLink) {
        templates[idx].alert = alertObj;
        break;
      }
    }

    this.setInData(['listView', 'itemsLoading'], false);
    this.setInData(['listView', 'items'], templates);
    this.emitChange();

    setTimeout(() => {
      var templates = utils.getIn(this.getData(), ['listView', 'items']).asMutable({
        deep: true
      });
      let idx;
      for (idx = 0; idx < templates.length; idx++) {
        if (templates[idx].documentSelfLink === templateDocumentSelfLink) {
          templates[idx].alert = alertObj;
          break;
        }
      }
      templates[idx].alert = null;

      this.setInData(['listView', 'items'], templates);
      this.emitChange();
    }, 3000);
  }
};

let getNetworkByName = function(networkDescriptions, name) {
  for (var i = 0; i < networkDescriptions.length; i++) {
    if (networkDescriptions[i].name === name) {
      return networkDescriptions[i];
    }
  }
};

/*
  Returns the user defined network descriptions (the ones coming from the service)
  together with the system ones that should be available for selection (host, bridge, ....)
*/
let getCompleteNetworkDescriptions = function(containerDescriptions, networkDescriptions) {
  var systemNetworkModes = [constants.NETWORK_MODES.BRIDGE.toLowerCase(),
    constants.NETWORK_MODES.HOST.toLowerCase()
  ];

  var result = networkDescriptions;

  for (let i = 0; i < result.length; i++) {
    var network = result[i];
    if (network.name) {
      let index = systemNetworkModes.indexOf(network.name.toLowerCase());
      if (index !== -1) {
        systemNetworkModes.splice(index, 1);
      }
    }
  }

  for (let i = 0; i < containerDescriptions.length; i++) {
    var cd = containerDescriptions[i];
    var networkNames = getNetworkNamesOfContainer(cd);

    for (let ni = 0; ni < networkNames.length; ni++) {
      var networkName = networkNames[ni];
      let index = systemNetworkModes.indexOf(networkName);
      if (index !== -1) {
        systemNetworkModes.splice(index, 1);
        result.push({
          documentSelfLink: links.SYSTEM_NETWORK_LINK + '/' + networkName,
          name: networkName
        });
      }
    }
  }

  return result;
};

let getUserDefinedNetworkDescriptions = function(networkDescriptions) {
  return networkDescriptions.filter(
    n => n.documentSelfLink.indexOf(links.SYSTEM_NETWORK_LINK) === -1);
};

let getNetworkLinks = function(containerDescriptions, networkDescriptions) {
  var networkLinks = {};
  for (var i = 0; i < containerDescriptions.length; i++) {
    var cd = containerDescriptions[i];
    var networkNames = getNetworkNamesOfContainer(cd);

    for (var ni = 0; ni < networkNames.length; ni++) {
      var network = getNetworkByName(networkDescriptions, networkNames[ni]);
      if (!network) {
        continue;
      }

      if (!networkLinks[cd.documentSelfLink]) {
        networkLinks[cd.documentSelfLink] = [];
      }

      networkLinks[cd.documentSelfLink].push(network.documentSelfLink);
    }
  }
  return networkLinks;
};

let getNetworkNamesOfContainer = function(cd) {
  var cdNetworks = [];
  if (cd.networks) {
    for (var key in cd.networks) {
      if (cd.networks.hasOwnProperty(key)) {
        cdNetworks.push(key);
      }
    }
  }
  if (cd.networkMode) {
    cdNetworks.push(cd.networkMode.toLowerCase());
  }

  return cdNetworks;
};

let updateContainersNetworks = function(attachContainersToNetworks, detachContainersToNetworks) {
  var networks = utils.getIn(this.getData(), ['selectedItemDetails', 'templateDetails',
    'listView', 'networks'
  ]);

  var containers = utils.getIn(this.getData(), ['selectedItemDetails', 'templateDetails',
    'listView', 'items'
  ]);

  var networksObj = {};
  for (let i = 0; i < networks.length; i++) {
    networksObj[networks[i].documentSelfLink] = networks[i];
  }

  var containersObj = {};
  for (let i = 0; i < containers.length; i++) {
    var container = containers[i].asMutable({
      deep: true
    });
    containersObj[container.documentSelfLink] = {
      documentSelfLink: container.documentSelfLink,
      networkMode: container.networkMode,
      networks: container.networks || {}
    };
  }

  var systemNetworkModes = [constants.NETWORK_MODES.BRIDGE.toLowerCase(),
    constants.NETWORK_MODES.HOST.toLowerCase(),
    constants.NETWORK_MODES.NONE.toLowerCase()
  ];

  var containerPatches = {};
  var promises = [];

  attachContainersToNetworks.forEach((containerToNetworks) => {
    var network = networksObj[containerToNetworks.networkDescriptionLink];

    var patchObject = containersObj[containerToNetworks.containerDescriptionLink];
    if (systemNetworkModes.indexOf(network.name.toLowerCase()) !== -1) {
      patchObject.networkMode = network.name;
    } else {
      patchObject.networks[network.name] = {};
    }
    containerPatches[containerToNetworks.containerDescriptionLink] = patchObject;
  });

  detachContainersToNetworks.forEach((containerToNetworks) => {
    var network = networksObj[containerToNetworks.networkDescriptionLink];

    var patchObject = containersObj[containerToNetworks.containerDescriptionLink];

    if (systemNetworkModes.indexOf(network.name.toLowerCase()) !== -1) {
      patchObject.networkMode = '';
    } else {
      delete patchObject.networks[network.name];
    }

    containerPatches[containerToNetworks.containerDescriptionLink] = patchObject;
  });

  for (var link in containerPatches) {
    if (containerPatches.hasOwnProperty(link)) {
      promises.push(
        services.patchDocument(link, containerPatches[link]));
    }
  }

  function updateDescriptions(patchDescriptions) {
    var containerDefs = utils.getIn(this.getData(), ['selectedItemDetails', 'templateDetails',
      'listView', 'items'
    ]);
    if (containerDefs) {
      containerDefs = containerDefs.map((cd) => {
        for (var key in patchDescriptions) {
          if (!patchDescriptions.hasOwnProperty(key)) {
            continue;
          }
          var patchDescription = patchDescriptions[key];
          if (cd.documentSelfLink === patchDescription.documentSelfLink) {
            cd = cd.asMutable();
            cd.networks = patchDescription.networks;
            cd.networkMode = patchDescription.networkMode;
          }
        }

        return cd;
      });

      updateNetworksAndLinks.call(this, containerDefs);

      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
        containerDefs);

      this.emitChange();
    }
  }

  updateDescriptions.call(this, containerPatches);

  Promise.all(promises).then((updatedDescriptions) => {
    updateDescriptions.call(this, updatedDescriptions);
  }).catch(this.onGenericEditError);
};

const DEFAULT_VOLUME_CONTAINER_PATH = '/container/project/path';

let getIndexVolumeInContainer = function(container, volumeName) {
  if (container.volumes) {
    return container.volumes.findIndex((volumeCmd) => volumeCmd.indexOf(volumeName) > -1);
  }

  return -1;
};

let updateContainersVolumes = function(attachContainersToVolumes, detachContainersToVolumes) {
  var volumes = utils.getIn(this.getData(),
                              ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']);
  var containers = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'items']);

  let containerPatchesAttach = attachContainersToVolumes.map((containerToVolumes) => {
    var volume = volumes.find((volume) =>
                              volume.documentSelfLink === containerToVolumes.volumeDescriptionLink);

    let containerDescriptionLink = containerToVolumes.containerDescriptionLink;
    var container = containers.find((container) =>
                                      container.documentSelfLink === containerDescriptionLink);
    container = container.asMutable({
      deep: true
    });

    var patchObject = {
      documentSelfLink: containerDescriptionLink,
      volumes: container.volumes || []
    };

    // [host_path|named_volume:]container_path[:ro]
    let volumeCmd = volume.name + ':' + DEFAULT_VOLUME_CONTAINER_PATH;

    patchObject.volumes.push(volumeCmd);

    return patchObject;
  });

  let containerPatchesDetach = detachContainersToVolumes.map((containerToVolumes) => {
    var volume = volumes.find((volume) =>
                              volume.documentSelfLink === containerToVolumes.volumeDescriptionLink);
    let containerDescriptionLink = containerToVolumes.containerDescriptionLink;
    var container = containers.find((container) =>
                                      container.documentSelfLink === containerDescriptionLink);
    container = container.asMutable({
      deep: true
    });

    var patchObject = {
      documentSelfLink: containerDescriptionLink,
      volumes: container.volumes
    };

    patchObject.volumes.splice(getIndexVolumeInContainer.call(this, patchObject, volume.name), 1);

    return patchObject;
  });

  function updateDescriptions(patchDescriptions) {
    var containerDescriptions = utils.getIn(this.getData(),
                                  ['selectedItemDetails', 'templateDetails', 'listView', 'items']);

    if (containerDescriptions) {
      var updateContainerDescriptions = patchDescriptions ? containerDescriptions.map((cd) => {

        let patchedDescription = patchDescriptions.find((pd) =>
                                                pd && pd.documentSelfLink === cd.documentSelfLink);
        if (patchedDescription) {
          cd = cd.asMutable();
          cd.volumes = patchedDescription.volumes;
        }

        return cd;
      }) : containerDescriptions;

      updateVolumeLinks.call(this, updateContainerDescriptions);

      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
                        updateContainerDescriptions);

      this.emitChange();
    }
  }

  let containerPatches = containerPatchesAttach.concat(containerPatchesDetach);

  var promises = containerPatches.map((patchObject) =>
    services.patchDocument(patchObject.documentSelfLink, patchObject));

  Promise.all(promises).then((updatedDescriptions) => {
    // Update template's container descriptions
    updateDescriptions.call(this, updatedDescriptions);

  }).catch(this.onGenericEditError);
};

let updateContainerDescriptionsWithNetwork = function(oldName, newName) {

  let containerDefs = utils.getIn(this.getData(),
                  ['selectedItemDetails', 'templateDetails', 'listView', 'items']);
  if (containerDefs) {
    containerDefs = containerDefs.map((cd) => {
      if (cd.networks[oldName] && oldName !== newName) {
        cd = cd.asMutable();
        cd.networks = cd.networks.asMutable();
        cd.networks[newName] = cd.networks[oldName];
        delete cd.networks[oldName];
        services.updateContainerDescription(cd);
      }
      return cd;
    });

    this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
              containerDefs);

    updateNetworksAndLinks.call(this, containerDefs);

    this.emitChange();
  }
};

let updateNetworksAndLinks = function(containerDescriptions) {
  var networks = this.data.selectedItemDetails.templateDetails.listView.networks;
  networks = networks.asMutable();
  networks = getCompleteNetworkDescriptions(containerDescriptions, networks);
  var networkLinks = getNetworkLinks(containerDescriptions, networks);

  this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'networks'], networks);
  this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'networkLinks'],
    networkLinks);
};

let updateContainerDescriptionsWithVolume = function(oldName, newName) {
  if (oldName === newName) {
    return;
  }

  let containerDefs = utils.getIn(this.getData(),
                                  ['selectedItemDetails', 'templateDetails', 'listView', 'items']);
  if (containerDefs) {
    var volumeNamePart = oldName + ':';
    containerDefs = containerDefs.map((containerDefinition) => {
      var containerDefinitionUpdated = false;
      containerDefinition.volumes = containerDefinition.volumes.map((volumeBinding) => {
        if (volumeBinding.startsWith(volumeNamePart)) {
          var containerPart = volumeBinding.replace(volumeNamePart, '');
          containerDefinitionUpdated = true;
          return newName + ':' + containerPart;
        } else {
          return volumeBinding;
        }
      });

      if (containerDefinitionUpdated) {
        services.updateContainerDescription(containerDefinition);
      }

      return containerDefinition;
    });

    this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'], containerDefs);

    updateVolumeLinks.call(this, containerDefs);

    this.emitChange();
  }
};

let updateVolumeLinks = function(containerDescriptions) {
  var volumes = this.data.selectedItemDetails.templateDetails.listView.volumes;

  var volumeLinks = getVolumeLinks(containerDescriptions, volumes);

  this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'volumeLinks'],
    volumeLinks);
};

let getContainerVolumeDescriptionLinks = function(containerVolumes, volumeDescriptions) {
  var containerVolumeDescriptionLinks = [];

  if (containerVolumes) {
    containerVolumes.forEach((containerVolumeString) => {
      let volDesc = utils.findVolume(containerVolumeString, volumeDescriptions);
      if (volDesc) {
        containerVolumeDescriptionLinks.push(volDesc.documentSelfLink);
      }
    });
  }

  return containerVolumeDescriptionLinks;
};

let getVolumeLinks = function(containerDescriptions, volumeDescriptions) {
  var volumeLinks = {};

  containerDescriptions.forEach((containerDescription) => {

    let containerVolumeDescriptionLinks =
      getContainerVolumeDescriptionLinks(containerDescription.volumes, volumeDescriptions);

    let containerDescSelfLink = containerDescription.documentSelfLink;
    if (!volumeLinks[containerDescSelfLink]) {
      volumeLinks[containerDescSelfLink] = [];
    }

    volumeLinks[containerDescSelfLink] = [...new Set(containerVolumeDescriptionLinks)];
  });

  return volumeLinks;
};

let TemplatesStore = Reflux.createStore({
  mixins: [ContextPanelStoreMixin, CrudStoreMixin],

  init: function() {
    RegistryStore.listen((registryData) => {
      if (this.data.registries) {
        this.setInData(['registries'], registryData);
        this.emitChange();
      }
    });

    if (utils.isApplicationEmbedded()) {
      services.loadGroups().then((groupsResult) => {
        let groups = Object.values(groupsResult);

        this.setInData(['groups'], groups);
        if (this.data.selectedItemDetails && this.data.selectedItemDetails.documentId) {
          this.setInData(['selectedItemDetails', 'groups'], groups);
        }
        this.emitChange();
      });
    } else {
      ResourceGroupsStore.listen((resourceGroupsData) => {
        let resourceGroups = resourceGroupsData.items;

        this.setInData(['groups'], resourceGroups);
        if (this.data.selectedItemDetails && this.data.selectedItemDetails.documentId) {
          this.setInData(['selectedItemDetails', 'groups'], resourceGroups);
        }

        this.emitChange();
      });
    }

    NotificationsStore.listen((notifications) => {
      this.setInData(['contextView', 'notifications', constants.CONTEXT_PANEL.REQUESTS],
        notifications.runningRequestItemsCount);

      this.setInData(['contextView', 'notifications', constants.CONTEXT_PANEL.EVENTLOGS],
        notifications.latestEventLogItemsCount);

      this.emitChange();
    });

    RequestsStore.listen((requestsData) => {
      if (this.isContextPanelActive(constants.CONTEXT_PANEL.REQUESTS)) {
        this.setActiveItemData(requestsData);
        this.emitChange();
      }
    });

    EventLogStore.listen((eventlogsData) => {
      if (this.isContextPanelActive(constants.CONTEXT_PANEL.EVENTLOGS)) {
        this.setActiveItemData(eventlogsData);
        this.emitChange();
      }
    });

    DeploymentPolicyStore.listen((policiesData) => {
      if (this.isContextPanelActive(constants.CONTEXT_PANEL.DEPLOYMENT_POLICIES)) {
        this.setActiveItemData(policiesData);
        this.emitChange();
      }
    });

    PlacementsStore.listen((placementsData) => {
      if (this.data.selectedItemDetails) {
        this.setInData(['selectedItemDetails', 'placements'], placementsData.items);
        this.emitChange();
      }
    });
  },

  listenables: [
    actions.TemplateActions,
    actions.RegistryActions,
    actions.TemplatesContextToolbarActions,
    actions.HostContextToolbarActions,
    actions.NavigationActions,
    actions.PlacementActions
  ],

  onOpenTemplates: function(queryOptions, forceReload) {
    var currentTemplates = this.data.listView && this.data.listView.items;

    if (!forceReload && currentTemplates && currentTemplates !== constants.LOADING) {
      return;
    }

    this.setInData(['listView', 'queryOptions'], queryOptions);
    this.setInData(['listView', 'error'], null);
    this.setInData(['listView', 'itemsLoading'], false);
    this.setInData(['registries'], null);
    this.setInData(['importTemplate'], null);
    this.setInData(['selectedItem'], null);
    this.setInData(['selectedItemDetails'], null);
    this.setInData(['contextView'], {});

    if (utils.isApplicationEmbedded()) {
      services.loadGroups().then((groupsResult) => {
        this.setInData(['groups'], Object.values(groupsResult));
        this.emitChange();
      }).catch((e) => {
        console.log('Could not load business groups', e);
      });
    } else {
      actions.ResourceGroupsActions.retrieveGroups();
    }

    if (queryOptions[constants.SEARCH_CATEGORY_PARAM] ===
          constants.TEMPLATES.SEARCH_CATEGORY.IMAGES) {
      this.loadAvailableRegistries();
    }

    var shouldLoadRecommended = !queryOptions ||
      (Object.keys(queryOptions).length === 1 &&
        (queryOptions[constants.SEARCH_CATEGORY_PARAM] ===
          constants.TEMPLATES.SEARCH_CATEGORY.ALL ||
          queryOptions[constants.SEARCH_CATEGORY_PARAM] ===
          constants.TEMPLATES.SEARCH_CATEGORY.IMAGES));
    if (shouldLoadRecommended) {
      loadRecommended.call(this);
    } else if (queryOptions[constants.SEARCH_CATEGORY_PARAM] ===
      constants.TEMPLATES.SEARCH_CATEGORY.CLOSURES) {
      searchClosures.call(this, queryOptions);
    } else {
      searchImages.call(this, queryOptions);
    }
  },

  onOpenRegistries: function() {
    this.setInData(['registries'], RegistryStore.getData());
    this.emitChange();
  },

  onOpenToolbarEventLogs: function(highlightedItemLink) {
    actions.EventLogActions.openEventLog(highlightedItemLink);
    this.openToolbarItem(constants.CONTEXT_PANEL.EVENTLOGS, EventLogStore.getData());
  },

  onOpenToolbarDeploymentPolicies: function() {
    actions.DeploymentPolicyActions.retrieveDeploymentPolicies();
    this.openToolbarItem(constants.CONTEXT_PANEL.DEPLOYMENT_POLICIES,
                         DeploymentPolicyStore.getData());
  },

  onOpenToolbarClosureResults: function() {
    this.openToolbarItem(constants.CONTEXT_PANEL.CLOSURES, null, false);
  },

  onOpenContainerRequest: function(type, itemId) {
    var containerRequest = {
      documentId: itemId,
      selectedForEdit: false,
      selectedForRequest: true
    };

    if (type === constants.TEMPLATES.TYPES.IMAGE) {

      let calls = [];
      calls.push(services.loadDeploymentPolicies());

      if (utils.isApplicationEmbedded()) {
        calls.push(services.loadGroups());
      } else {
        actions.ResourceGroupsActions.retrieveGroups();
      }

      Promise.all(calls).then(([policies, groupsResult]) => {
        containerRequest.definitionInstance = {
          image: itemId,
          name: utils.getDocumentId(itemId),
          deploymentPolicies: policies
        };

        if (groupsResult) {
          containerRequest.groups = Object.values(groupsResult);
        } else {
          containerRequest.groups = ResourceGroupsStore.getData().items;
        }

        this.setInData(['selectedItem'], containerRequest);
        this.setInData(['selectedItemDetails'], containerRequest);

        this.emitChange();
      });
    }

    this.setInData(['selectedItem'], containerRequest);
    this.setInData(['selectedItemDetails'], containerRequest);

    this.emitChange();
  },

  onOpenKubernetesDeploymentRequest: function(type, itemId) {
    var containerRequest = {
      documentId: itemId,
      selectedForEdit: false,
      selectedForRequest: false,
      selectForKubernetesDeployment: true
    };

    containerRequest.definitionInstance = {
      image: itemId,
      name: utils.getDocumentId(itemId)
    };

    this.setInData(['selectedItem'], containerRequest);
    this.setInData(['selectedItemDetails'], containerRequest);

    this.emitChange();
  },

  onOpenTemplateDetails: function(type, itemId) {
    var detailsObject = {
      documentId: itemId,
      type: type,
      selectedForEdit: true,
      selectedForRequest: false
    };

    if (type === constants.TEMPLATES.TYPES.TEMPLATE) {
      detailsObject.templateDetails = {};
      detailsObject.templateDetails.listView = {};
      detailsObject.templateDetails.listView.itemsLoading = true;

      let calls = [];
      calls.push(services.loadContainerTemplate(itemId));

      if (utils.isApplicationEmbedded()) {
        calls.push(services.loadGroups());
      } else {
        actions.ResourceGroupsActions.retrieveGroups();
      }

      Promise.all(calls).then(([template, groupsResult]) => {
        // groups
        if (groupsResult) {
          detailsObject.groups = Object.values(groupsResult);
        } else {
          detailsObject.groups = ResourceGroupsStore.getData().items;
        }

        // template items
        var descriptionPromises = [];
        for (let i = 0; i < template.descriptionLinks.length; i++) {
          descriptionPromises.push(services.loadDocument(template.descriptionLinks[i]));
        }

        Promise.all(descriptionPromises).then((descriptions) => {
          var containerDescriptions = [];
          var networkDescriptions = [];
          var volumeDescriptions = [];
          var closureDescriptions = [];
          var kubernetesDescriptions = [];

          for (let i = 0; i < descriptions.length; i++) {
            var desc = descriptions[i];
            let docSelfLink = desc.documentSelfLink;

            if (docSelfLink.indexOf(links.CONTAINER_DESCRIPTIONS) > -1) {
              // container
              containerDescriptions.push(desc);
            } else if (docSelfLink.indexOf(links.CONTAINER_NETWORK_DESCRIPTIONS) > -1) {
              // network
              networkDescriptions.push(desc);
            } else if (docSelfLink.indexOf(links.CONTAINER_VOLUMES_DESCRIPTIONS) > -1) {
              // volume
              volumeDescriptions.push(desc);
            } else if (docSelfLink.indexOf(links.CLOSURE_DESCRIPTIONS) > -1) {
              // closure
              closureDescriptions.push(desc);
            } else if (docSelfLink.indexOf(links.KUBERNETES_DESC) > -1) {
              // k8s
              kubernetesDescriptions.push(desc);
            }
          }

          for (let i = 0; i < containerDescriptions.length; i++) {
            _enhanceContainerDescription(containerDescriptions[i], containerDescriptions);
          }

          networkDescriptions = getCompleteNetworkDescriptions(containerDescriptions,
                                                                networkDescriptions);
          var networkLinks = getNetworkLinks(containerDescriptions, networkDescriptions);
          var volumeLinks = getVolumeLinks(containerDescriptions, volumeDescriptions);

          detailsObject.templateDetails.name = template.name;
          detailsObject.templateDetails.documentSelfLink = template.documentSelfLink;

          detailsObject.templateDetails.listView.items = containerDescriptions;
          detailsObject.templateDetails.listView.itemsLoading = false;

          detailsObject.templateDetails.listView.networks = networkDescriptions;
          detailsObject.templateDetails.listView.networkLinks = networkLinks;

          detailsObject.templateDetails.listView.volumes = volumeDescriptions;
          detailsObject.templateDetails.listView.volumeLinks = volumeLinks;

          detailsObject.templateDetails.listView.closures = closureDescriptions;

          detailsObject.templateDetails.listView.kubernetes = kubernetesDescriptions;

          this.setInData(['selectedItemDetails'], detailsObject);
          this.emitChange();
        }).catch((e) => {
          console.error('Failed retrieving template items', e);
        });
      }).catch((e) => {
        console.error('Failed retrieving template/groups', e);
      });
    }

    this.setInData(['selectedItem'], detailsObject);
    this.setInData(['selectedItemDetails'], detailsObject);
    this.emitChange();
  },

  setContainerDefinitionData: function(containerDefinition) {
    var containerDefs = utils.getIn(this.getData(),
                                  ['selectedItemDetails', 'templateDetails', 'listView', 'items']);
    _enhanceContainerDescription(containerDefinition, containerDefs);

    this.setInData(['selectedItemDetails', 'editContainerDefinition', 'definitionInstance'],
      containerDefinition);
  },

  onOpenAddNewContainerDefinition: function() {
    this.setInData(['selectedItemDetails', 'newContainerDefinition'], {});
    loadRecommended.call(this, true);
  },

  onOpenEditContainerDefinition: function(documentSelfLink) {

    services.loadDocument(documentSelfLink).then((containerDefinition) => {

      services.loadDeploymentPolicies().then((policies) => {

        containerDefinition.deploymentPolicies = policies;

        var networks = utils.getIn(this.getData(),
                          ['selectedItemDetails', 'templateDetails', 'listView', 'networks']) || [];
        containerDefinition.availableNetworks = getUserDefinedNetworkDescriptions(networks);

        var volumes = utils.getIn(this.getData(),
                          ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']) || [];
        containerDefinition.availableVolumes = volumes;

        this.setContainerDefinitionData(containerDefinition);

        this.emitChange();
      });
    }).catch(this.onGenericEditError);
  },

  onOpenEditNetwork: function(editDefinitionSelectedNetworks, network) {
    this.setInData(['selectedItemDetails', 'editNetwork'], {
      editDefinitionSelectedNetworks: editDefinitionSelectedNetworks,
      definitionInstance: network || {}
    });
    this.emitChange();
  },

  onOpenEditKubernetesDefinition: function(kubernetesDefinition) {
    this.setInData(['selectedItemDetails', 'editKubernetes'], {
      definitionInstance: kubernetesDefinition || {}
    });
    this.emitChange();
  },

  onCancelEditKubernetesDefinition: function() {
    this.setInData(['selectedItemDetails', 'editKubernetes'], null);
    this.emitChange();
  },

  onOpenAddClosure: function(closureDescription) {
    var addClosureView = {};
    if (closureDescription) {
      this.setInData(['selectedItemDetails', 'tasks', 'editingItemData', 'item'],
        closureDescription);
      this.setInData(['selectedItemDetails', 'addClosureView'], addClosureView);
    } else {
      this.setInData(['selectedItemDetails', 'tasks'], {});
      this.setInData(['selectedItemDetails', 'addClosureView'], addClosureView);
    }
    this.setInData(['selectedItemDetails', 'contextView'], {});
    this.emitChange();

    Promise.all([
          services.loadPlacements()
    ]).then((placementsResult) => {
          let placements = Object.values(placementsResult[0]);
          this.setInData(['selectedItemDetails', 'placements'], placements);
          this.emitChange();
        });

    if (closureDescription) {
      var _this = this;
      _this.loadClosurePlacement(closureDescription);
    }
  },

  onCancelAddClosure: function() {
    this.setInData(['selectedItemDetails', 'addClosureView'], null);
    this.emitChange();
  },

  loadClosurePlacement: function(closureDescription) {
    var _this = this;

    if (closureDescription.customProperties
     && closureDescription.customProperties.__closures_placement) {
      Promise.all([
          services.loadPlacement(closureDescription.customProperties.__closures_placement)
        ])
        .then(function([placement]) {

          _this.setInData(['selectedItemDetails', 'tasks', 'editingItemData',
              'placement'
            ],
            placement);

          _this.emitChange();
        });
    }
  },

  onRemoveClosure: function(closureDesc, templateId) {
    if (!templateId) {

      services.deleteClosure(closureDesc).then(() => {
        let queryOptions = this.selectFromData(['listView', 'queryOptions']).get();
        // Refresh view
        this.onOpenTemplates(queryOptions, true);
      }).catch(this.onGenericCreateError);

      return;
    }

    let descriptionLink = closureDesc.documentSelfLink;

    let doDelete = function() {
      let closures = this.data.selectedItemDetails.templateDetails.listView.closures
        .filter(item => item.documentSelfLink !== descriptionLink);

      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'closures'],
        closures);
      this.emitChange();
    };

    // MOVE TO COMPLETION  HANDLER
    doDelete.call(this);

    services.deleteDocument(descriptionLink).then(() => {
      return services.loadContainerTemplate(templateId);

    }).then((template) => {
      let index = template.descriptionLinks.indexOf(descriptionLink);
      template.descriptionLinks.splice(index, 1);

      return services.updateContainerTemplate(template);

    }).then(() => {
      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {
        doDelete.call(this);
      }
    }).catch(this.onGenericEditError);
  },

  createClosure: function(templateId, closureDescription) {
    if (!templateId) {
      return services.createClosure(closureDescription);
    }

    return services.createClosure(closureDescription).then((createdClosure) => {
      return services.loadContainerTemplate(templateId).then((template) => {

        template.descriptionLinks.push(createdClosure.documentSelfLink);

        return services.updateContainerTemplate(template);
      }).then(() => {
        var closures = utils.getIn(this.getData(), ['selectedItemDetails',
          'templateDetails', 'listView', 'closures'
        ]);

        closures = closures.asMutable();
        closures.push(createdClosure);
        this.setInData(
          ['selectedItemDetails', 'templateDetails', 'listView', 'closures'], closures);
        this.emitChange();

        return createdClosure;
      });
    });
  },

  saveClosure: function(templateId, closureDescription) {
    if (!closureDescription.documentSelfLink) {
      this.createClosure(templateId, closureDescription)
        .then(() => {
          if (templateId) {
            this.onCancelAddClosure();
          } else {
            let queryOptions = this.selectFromData(['listView', 'queryOptions']).get();
            // Refresh view
            this.onOpenTemplates(queryOptions, true);
          }
        }).catch(this.onGenericEditError);
    } else {
      services.editClosure(closureDescription).then((updatedClosure) => {
        if (templateId) {
          var closures = utils.getIn(this.getData(), ['selectedItemDetails',
            'templateDetails', 'listView', 'closures'
          ]).map((n) => n.documentSelfLink === updatedClosure.documentSelfLink ?
            updatedClosure : n);

          this.setInData(
            ['selectedItemDetails', 'templateDetails', 'listView', 'closures'], closures);

          this.emitChange();
          this.onCancelAddClosure();
        } else {
          let queryOptions = this.selectFromData(['listView', 'queryOptions']).get();
          // Refresh view
          this.onOpenTemplates(queryOptions, true);
        }
      }).catch(this.onGenericEditError);
    }
  },

  runClosure: function(templateId, closureDescription, inputs) {
    var createRun = (closureDescription) => {
      return services.runClosure(closureDescription, inputs).then((request) => {
        this.setInData(['tasks', 'monitoredTask'], request);
        this.setInData(['selectedItemDetails', 'tasks', 'monitoredTask', 'isRunning'], {});

        if (templateId) {
          var closures = utils.getIn(this.getData(), ['selectedItemDetails',
            'templateDetails', 'listView', 'closures'
          ]).map((n) => n.documentSelfLink === request.documentSelfLink ? request : n);

          this.setInData(
            ['selectedItemDetails', 'templateDetails', 'listView', 'closures'], closures);
          this.emitChange();
        }
        if (!this.requestCheckInterval) {
          this.requestCheckInterval = setInterval(this.refreshMonitoredTask,
            CHECK_INTERVAL_MS);
        }
      });
    };

    this.setInData(['tasks', 'monitoredTask'], null);
    this.emitChange();

    if (!closureDescription.documentSelfLink) {
      this.createClosure(templateId, closureDescription).then((createdClosure) => {
        this.openAddClosure(createdClosure);
        return createRun(createdClosure);
      }).catch(this.onGenericEditError);
    } else {
      services.editClosure(closureDescription).then(() => {
        return createRun(closureDescription);
      }).catch(this.onGenericEditError);
    }
  },

  refreshMonitoredTask: function() {
    var task = this.data.tasks.monitoredTask;
    if (task) {
      if (task.state === 'FINISHED' || task.state === 'FAILED' || task.state === 'CANCELLED') {
        this.stopTaskRefresh();
        this.fetchLogs();

        this.setInData(['selectedItemDetails', 'tasks', 'monitoredTask', 'isRunning'], null);
        this.emitChange();
        return;
      }
      services.getClosure(task.documentSelfLink).then((fetchedTask) => {
        this.setInData(['tasks', 'monitoredTask'], fetchedTask);
        this.setInData(['tasks', 'monitoredTask', 'taskId'],
          fetchedTask.documentSelfLink.split('/').pop());
        this.emitChange();
        if (fetchedTask.resourceLinks && fetchedTask.resourceLinks.length > 0) {
          this.fetchLogs();
        }
      });
    } else {
      console.warn('No available closure to monitor!');
    }
  },
  resetMonitoredClosure: function() {
    if (this.data.tasks) {
      this.setInData(['tasks', 'monitoredTask'], null);
      this.emitChange();
    }
  },
  stopTaskRefresh: function() {
    if (this.requestCheckInterval) {
      clearInterval(this.requestCheckInterval);
      this.requestCheckInterval = null;
    }
  },
  fetchLogs: function() {
    var task = this.data.tasks.monitoredTask;
    if (typeof task.resourceLinks === 'undefined' || task.resourceLinks.length <= 0) {
      console.log('No resources to fetch logs...');
      this.setInData(['tasks', 'monitoredTask', 'taskLogs'], task.errorMsg);
      this.emitChange();
      return;
    }

    var taskLogResource = task.resourceLinks[0].split('/').pop();
    console.log('Requesting logs from: ' + taskLogResource);
    services.getClosureLogs(taskLogResource).then((fetchedLogs) => {
      this.setInData(['tasks', 'monitoredTask', 'taskLogs'], atob(fetchedLogs.logs));
      this.emitChange();
    });
  },

  onCancelEditNetwork: function() {
    var cdSelector = this.selectFromData(['selectedItemDetails', 'editContainerDefinition',
      'definitionInstance'
    ]);
    var editNetworkSelector = this.selectFromData(['selectedItemDetails', 'editNetwork']);

    var editDefinitionSelectedNetworks = editNetworkSelector.getIn(
      ['editDefinitionSelectedNetworks']);
    if (cdSelector.get() && editDefinitionSelectedNetworks) {
      editDefinitionSelectedNetworks = editDefinitionSelectedNetworks.asMutable();
      delete editDefinitionSelectedNetworks[constants.NEW_ITEM_SYSTEM_VALUE];

      var networks = utils.getIn(this.getData(), ['selectedItemDetails', 'templateDetails',
        'listView', 'networks'
      ]);

      cdSelector.setIn('availableNetworks', getUserDefinedNetworkDescriptions(networks));
      cdSelector.setIn('networks', editDefinitionSelectedNetworks);
    }
    editNetworkSelector.clear();

    this.emitChange();
  },

  onSaveNetwork: function(templateId, network) {
    this.setInData(['selectedItemDetails', 'editNetwork', 'definitionInstance'], network);

    if (network.documentSelfLink) {
      // Existing network description
      services.updateDocument(network.documentSelfLink, network).then((updatedDescription) => {
        if (this.data.selectedItemDetails &&
          this.data.selectedItemDetails.documentId === templateId) {

          var networks = utils.getIn(this.getData(),
                               ['selectedItemDetails', 'templateDetails', 'listView', 'networks']);
          var editedNetwork = null;

          networks = networks.map((n) => {
            if (n.documentSelfLink === updatedDescription.documentSelfLink) {
              editedNetwork = n;
              return updatedDescription;
            } else {
              return n;
            }
          });

          this.setInData(
            ['selectedItemDetails', 'templateDetails', 'listView', 'networks'],
            networks);

          this.setInData(['selectedItemDetails', 'editNetwork'], null);

          updateContainerDescriptionsWithNetwork.call(this, editedNetwork.name,
                                                      updatedDescription.name);
          this.emitChange();
        }
      }).catch(this.onGenericEditError);
    } else {
      // New network description
      services.createNetworkDescription(network).then((createdDescription) => {
        services.loadContainerTemplate(templateId).then((template) => {

          template.descriptionLinks.push(createdDescription.documentSelfLink);

          return services.updateContainerTemplate(template);

        }).then(() => {

          if (this.data.selectedItemDetails &&
            this.data.selectedItemDetails.documentId === templateId) {

            var networks = utils.getIn(this.getData(), ['selectedItemDetails',
              'templateDetails', 'listView',
              'networks'
            ]);
            networks = networks.asMutable();
            networks.push(createdDescription);
            this.setInData(
              ['selectedItemDetails', 'templateDetails', 'listView', 'networks'],
              networks);

            var isEditContainerDefinition = utils.getIn(this.getData(), ['selectedItemDetails',
              'editContainerDefinition',
              'definitionInstance'
            ]);
            var cdSelector;
            if (isEditContainerDefinition) {
              cdSelector = this.selectFromData(['selectedItemDetails',
                'editContainerDefinition',
                'definitionInstance'
              ]);
            } else {
              cdSelector = this.selectFromData(['selectedItemDetails',
                'newContainerDefinition',
                'definitionInstance'
              ]);
            }

            var editNetworkSelector = this.selectFromData(['selectedItemDetails',
              'editNetwork'
            ]);

            var editDefinitionSelectedNetworks = editNetworkSelector.getIn(
              ['editDefinitionSelectedNetworks']);
            if (cdSelector.get() && editDefinitionSelectedNetworks) {
              editDefinitionSelectedNetworks = editDefinitionSelectedNetworks.asMutable();
              delete editDefinitionSelectedNetworks[constants.NEW_ITEM_SYSTEM_VALUE];
              editDefinitionSelectedNetworks[createdDescription.name] = {};

              cdSelector.setIn('availableNetworks', getUserDefinedNetworkDescriptions(
                networks));
              cdSelector.setIn('networks', editDefinitionSelectedNetworks);
            }
            editNetworkSelector.clear();

            this.emitChange();
          }
        }).catch(this.onGenericEditError);
      }).catch(this.onGenericEditError);
    }
  },

  onRemoveNetwork: function(templateId, network) {
    var networkDescirptionLink = network.documentSelfLink;

    var doDelete = function() {
      var containers = this.data.selectedItemDetails.templateDetails.listView.items;

      var networks = this.data.selectedItemDetails.templateDetails.listView.networks
        .filter((item) => {
          return item.documentSelfLink !== networkDescirptionLink;
        });

      var containersToDetach = [];
      containers.forEach((c) => {
        if (c.networkMode && c.networkMode === network.name) {
          containersToDetach.push({
            containerDescriptionLink: c.documentSelfLink,
            networkDescriptionLink: networkDescirptionLink
          });
        }
        if (c.networks && c.networks[network.name]) {
          containersToDetach.push({
            containerDescriptionLink: c.documentSelfLink,
            networkDescriptionLink: networkDescirptionLink
          });
        }
      });
      var containersToAttach = [];
      updateContainersNetworks.call(this, containersToAttach, containersToDetach);

      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'networks'],
        networks);
      this.emitChange();
    };

    if (networkDescirptionLink.indexOf(links.SYSTEM_NETWORK_LINK) === 0) {
      doDelete.call(this);
      return;
    }

    services.deleteDocument(networkDescirptionLink).then(() => {
      return services.loadContainerTemplate(templateId);

    }).then((template) => {
      var index = template.descriptionLinks.indexOf(networkDescirptionLink);
      template.descriptionLinks.splice(index, 1);

      return services.updateContainerTemplate(template);

    }).then(() => {

      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {
        doDelete.call(this);
      }
    }).catch(this.onGenericEditError);
  },

  onAttachNetwork: function(containerDescriptionLink, networkDescriptionLink) {
    var containersToAttach = [{
      containerDescriptionLink: containerDescriptionLink,
      networkDescriptionLink: networkDescriptionLink
    }];
    var containersToDetach = [];
    updateContainersNetworks.call(this, containersToAttach, containersToDetach);
  },

  onDetachNetwork: function(containerDescriptionLink, networkDescriptionLink) {
    var containersToAttach = [];
    var containersToDetach = [{
      containerDescriptionLink: containerDescriptionLink,
      networkDescriptionLink: networkDescriptionLink
    }];
    updateContainersNetworks.call(this, containersToAttach, containersToDetach);
  },

  onAttachDetachNetwork: function(oldContainerDescriptionLink, oldNetworkDescriptionLink,
    newContainerDescriptionLink, newNetworkDescriptionLink) {
    if (oldContainerDescriptionLink === newContainerDescriptionLink &&
      oldNetworkDescriptionLink === newNetworkDescriptionLink) {
      return;
    }

    var containersToAttach = [{
      containerDescriptionLink: newContainerDescriptionLink,
      networkDescriptionLink: newNetworkDescriptionLink
    }];
    var containersToDetach = [{
      containerDescriptionLink: oldContainerDescriptionLink,
      networkDescriptionLink: oldNetworkDescriptionLink
    }];
    updateContainersNetworks.call(this, containersToAttach, containersToDetach);
  },

  // Volumes
  onOpenEditVolume: function(editDefinitionSelectedVolumes, volume) {
    this.setInData(['selectedItemDetails', 'editVolume'], {
      editDefinitionSelectedVolumes: editDefinitionSelectedVolumes,
      definitionInstance: volume || {}
    });
    this.emitChange();
  },

  onCancelEditVolume: function() {
    var cursorDefinitionInstance = this.selectFromData(['selectedItemDetails',
                                            'editContainerDefinition', 'definitionInstance']);
    var cursorEditVolume = this.selectFromData(['selectedItemDetails', 'editVolume']);

    var editDefinitionSelectedVolumes = cursorEditVolume.getIn(['editDefinitionSelectedVolumes']);
    if (cursorDefinitionInstance.get() && editDefinitionSelectedVolumes) {

      editDefinitionSelectedVolumes = editDefinitionSelectedVolumes.asMutable();
      delete editDefinitionSelectedVolumes[constants.NEW_ITEM_SYSTEM_VALUE];

      var volumes = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']);

      cursorDefinitionInstance.setIn('availableVolumes', volumes);
      cursorDefinitionInstance.setIn('volumes', editDefinitionSelectedVolumes);
    }
    cursorEditVolume.clear();

    this.emitChange();
  },

  onSaveVolume: function(templateId, volume) {
    this.setInData(['selectedItemDetails', 'editVolume', 'definitionInstance'], volume);

    if (volume.documentSelfLink) {
      // Existing volume description
      services.updateDocument(volume.documentSelfLink, volume).then((updatedDescription) => {
        if (this.data.selectedItemDetails &&
          this.data.selectedItemDetails.documentId === templateId) {

          var volumes = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']);
          var editedVolume = null;

          volumes = volumes.map((n) => {
            if (n.documentSelfLink === updatedDescription.documentSelfLink) {
              editedVolume = n;
              return updatedDescription;
            } else {
              return n;
            }
          });

          this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'volumes'],
                            volumes);

          this.setInData(['selectedItemDetails', 'editVolume'], null);

          updateContainerDescriptionsWithVolume.call(this, editedVolume.name,
                                                        updatedDescription.name);
          this.emitChange();
        }
      }).catch(this.onGenericEditError);
    } else {
      // New volume description
      services.createVolumeDescription(volume).then((createdDescription) => {
        // Update the template with link to the volume description
        services.loadContainerTemplate(templateId).then((template) => {

          template.descriptionLinks.push(createdDescription.documentSelfLink);

          return services.updateContainerTemplate(template);

        }).then(() => {

          if (this.data.selectedItemDetails &&
            this.data.selectedItemDetails.documentId === templateId) {

            var volumes = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']);
            volumes = volumes.asMutable();
            volumes.push(createdDescription);

            this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'volumes'],
                              volumes);

            var isEditContainerDefinition = utils.getIn(this.getData(),
                          ['selectedItemDetails', 'editContainerDefinition', 'definitionInstance']);

            var cursorContainerDefinition;
            if (isEditContainerDefinition) {
              cursorContainerDefinition = this.selectFromData(
                          ['selectedItemDetails', 'editContainerDefinition', 'definitionInstance']);
            } else {
              cursorContainerDefinition = this.selectFromData(
                          ['selectedItemDetails', 'newContainerDefinition', 'definitionInstance']);
            }

            var cursorEditVolume = this.selectFromData(['selectedItemDetails', 'editVolume']);
            var editDefinitionSelectedVolumes =
                                        cursorEditVolume.getIn(['editDefinitionSelectedVolumes']);

            if (cursorContainerDefinition.get() && editDefinitionSelectedVolumes) {

              editDefinitionSelectedVolumes = editDefinitionSelectedVolumes.asMutable();
              delete editDefinitionSelectedVolumes[constants.NEW_ITEM_SYSTEM_VALUE];
              editDefinitionSelectedVolumes[createdDescription.name] = {};

              cursorContainerDefinition.setIn('availableVolumes', volumes);
              cursorContainerDefinition.setIn('volumes', editDefinitionSelectedVolumes);
            }

            cursorEditVolume.clear();

            this.emitChange();
          }
        }).catch(this.onGenericEditError);
      }).catch(this.onGenericEditError);
    }
  },

  onAttachVolume: function(containerDescriptionLink, volumeDescriptionLink) {
    var containersToAttach = [{
      containerDescriptionLink: containerDescriptionLink,
      volumeDescriptionLink: volumeDescriptionLink
    }];
    var containersToDetach = [];

    updateContainersVolumes.call(this, containersToAttach, containersToDetach);
  },

  onDetachVolume: function(containerDescriptionLink, volumeDescriptionLink) {
    var containersToAttach = [];
    var containersToDetach = [{
      containerDescriptionLink: containerDescriptionLink,
      volumeDescriptionLink: volumeDescriptionLink
    }];

    updateContainersVolumes.call(this, containersToAttach, containersToDetach);
  },

  onAttachDetachVolume: function(oldContainerDescriptionLink, oldVolumeDescriptionLink,
                                  newContainerDescriptionLink, newVolumeDescriptionLink) {
    if (oldContainerDescriptionLink === newContainerDescriptionLink &&
      oldVolumeDescriptionLink === newVolumeDescriptionLink) {
      return;
    }

    var containersToAttach = [{
      containerDescriptionLink: newContainerDescriptionLink,
      volumeDescriptionLink: newVolumeDescriptionLink
    }];
    var containersToDetach = [{
      containerDescriptionLink: oldContainerDescriptionLink,
      volumeDescriptionLink: oldVolumeDescriptionLink
    }];

    updateContainersVolumes.call(this, containersToAttach, containersToDetach);
  },

  onEditAttachedVolume(containerDescriptionLink, volumeDescriptionLink, containerPath) {
    var volumes = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'volumes']);
    var containers = utils.getIn(this.getData(),
                                ['selectedItemDetails', 'templateDetails', 'listView', 'items']);

    var volume = volumes.find((volume) =>
                                  volume.documentSelfLink === volumeDescriptionLink);
    var container = containers.find((container) =>
                                        container.documentSelfLink === containerDescriptionLink);

    container = container.asMutable({
      deep: true
    });

    var patchObject = {
      documentSelfLink: containerDescriptionLink,
      volumes: container.volumes || []
    };

    // [host_path|named_volume:]container_path[:ro]
    let newVolumeCmd = volume.name + ':' + containerPath;
    let volumeCmd = patchObject.volumes.find((volumeCmd) => volumeCmd.indexOf(volume.name) > -1);
    if (volumeCmd) {
      let idxVolumeCmd = patchObject.volumes.indexOf(volumeCmd);
      patchObject.volumes.splice(idxVolumeCmd, 1);
    }
    patchObject.volumes.push(newVolumeCmd);

    services.patchDocument(patchObject.documentSelfLink, patchObject)
      .catch((e) => {
        var validationErrors = utils.getValidationErrors(e);
        var currentInstanceSelector = this.selectFromData(['selectedItemDetails',
                                                            'templateDetails']);

        currentInstanceSelector.setIn(['error'], validationErrors);
        this.emitChange();
      }
    );
  },

  onRemoveVolume: function(templateId, volume) {
    var volumeDescriptionLink = volume.documentSelfLink;

    services.deleteDocument(volumeDescriptionLink).then(() => {
      // the volume description is deleted
      return services.loadContainerTemplate(templateId);

    }).then((template) => {
      // remove reference to volume description from the template
      var index = template.descriptionLinks.indexOf(volumeDescriptionLink);
      template.descriptionLinks.splice(index, 1);

      return services.updateContainerTemplate(template);

    }).then(() => {

      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {

        var containers = this.data.selectedItemDetails.templateDetails.listView.items;

        var volumes = this.data.selectedItemDetails.templateDetails.listView.volumes
          .filter((item) => {
            return item.documentSelfLink !== volumeDescriptionLink;
          });

        var containersToDetach = [];
        containers.forEach((container) => {

          let idxVolume = getIndexVolumeInContainer.call(this, container, volume.name);
          if (idxVolume > -1) {
            containersToDetach.push({
              containerDescriptionLink: container.documentSelfLink,
              volumeDescriptionLink: volumeDescriptionLink
            });
          }
        });

        var containersToAttach = [];

        updateContainersVolumes.call(this, containersToAttach, containersToDetach);

        this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'volumes'], volumes);
        this.emitChange();
      }
    }).catch(this.onGenericEditError);
  },

  onSaveKubernetesDefinition: function(templateId, kubernetesContent, kubernetesDefinition) {
    if (kubernetesDefinition && kubernetesDefinition.documentSelfLink) {
      kubernetesDefinition = kubernetesDefinition.asMutable();
      kubernetesDefinition.kubernetesEntity = kubernetesContent;
      services.updateDocument(kubernetesDefinition.documentSelfLink, kubernetesDefinition)
        .then((updatedDefinition) => {
        if (this.data.selectedItemDetails &&
          this.data.selectedItemDetails.documentId === templateId) {

          var listViewItems = this.data.selectedItemDetails.templateDetails.listView.kubernetes.map(
            (i) => {
            if (i.documentSelfLink === updatedDefinition.documentSelfLink) {
              return updatedDefinition;
            }
            return i;
          });

          this.setInData(['selectedItemDetails', 'editKubernetes'], null);
          this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'kubernetes'],
                            listViewItems);
          this.emitChange();
        }
      }).catch(this.onGenericEditError);
    } else {
      services.importKubernetesDescriptions(kubernetesContent).then((createdDescriptionsLinks) => {
        return services.loadContainerTemplate(templateId).then((template) => {
          template.descriptionLinks = template.descriptionLinks.concat(createdDescriptionsLinks);

          return services.updateContainerTemplate(template);
        }).then(() => {
          var getPromises = createdDescriptionsLinks.map(link => services.loadDocument(link));
          return Promise.all(getPromises);
        }).then((descriptions) => {
          if (this.data.selectedItemDetails &&
            this.data.selectedItemDetails.documentId === templateId) {

            var listViewItems = this.data.selectedItemDetails.templateDetails
              .listView.kubernetes.asMutable();

            listViewItems = listViewItems.concat(descriptions);

            this.setInData(['selectedItemDetails', 'editKubernetes'], null);
            this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'kubernetes'],
                              listViewItems);
            this.emitChange();
          }
        }).catch(this.onGenericEditError);
      }).catch(this.onGenericEditError);
    }
  },

  onRemoveKubernetesDefinition: function(kubernetesDefinition) {
    var templateId = this.data.selectedItemDetails.documentId;
    var kubernetesDefinitionLink = kubernetesDefinition.documentSelfLink;

    services.deleteDocument(kubernetesDefinitionLink).then(() => {
      return services.loadContainerTemplate(templateId);

    }).then((template) => {
      var index = template.descriptionLinks.indexOf(kubernetesDefinitionLink);
      template.descriptionLinks.splice(index, 1);

      return services.updateContainerTemplate(template);

    }).then(() => {

      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {

        var listViewItems = this.data.selectedItemDetails.templateDetails.listView.kubernetes
          .filter(item => item.documentSelfLink !== kubernetesDefinitionLink);


        this.setInData(['selectedItemDetails', 'editKubernetes'], null);
        this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'kubernetes'],
          listViewItems);
        this.emitChange();
      }
    }).catch(this.onContainerDescriptionDeleteError);
  },

  // Modify cluster size
  onIncreaseClusterSize: function(containerDefinition) {

    return this.modifyDescriptionClusterSize(containerDefinition, true);
  },

  onDecreaseClusterSize: function(containerDefinition) {

    return this.modifyDescriptionClusterSize(containerDefinition, false);
  },

  modifyDescriptionClusterSize: function(containerDefinition, increment) {
    var template = containerDefinition.asMutable({
      deep: true
    });

    if (increment) {
      if (!template._cluster) {
        template._cluster = 1;
      }
      template._cluster += 1;

    } else if (template._cluster > 1) { // decrement
      template._cluster -= 1;
    }

    services.updateContainerDescription(template).then((updatedDefinition) => {

      var listViewItems =
        this.data.selectedItemDetails.templateDetails.listView.items.asMutable({
          deep: true
        });

      for (var i = 0; i < listViewItems.length; i++) {
        if (listViewItems[i].documentSelfLink === updatedDefinition.documentSelfLink) {

          listViewItems[i]._cluster = updatedDefinition._cluster;
          break;
        }
      }

      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
        listViewItems);
      this.emitChange();

    }).catch(this.onGenericEditError);
  },

  onAddContainerDefinition: function(templateId, containerDefinition) {

    services.createContainerDescription(containerDefinition).then((createdDefinition) => {

      services.loadContainerTemplate(templateId).then((template) => {
        if (!template.descriptionLinks) {
          template.descriptionLinks = [];
        }

        template.descriptionLinks.push(createdDefinition.documentSelfLink);

        return services.updateContainerTemplate(template);

      }).then(() => {

        if (this.data.selectedItemDetails &&
          this.data.selectedItemDetails.documentId === templateId) {

          var listViewItems = this.data.selectedItemDetails.templateDetails.listView.items
            .asMutable({
              deep: true
            });

          _enhanceContainerDescription(createdDefinition, listViewItems);
          listViewItems.push(createdDefinition);

          for (let i = 0; i < listViewItems.length; i++) {
            _enhanceContainerDescription(listViewItems[i], listViewItems);
          }

          updateNetworksAndLinks.call(this, listViewItems);
          updateVolumeLinks.call(this, listViewItems);

          this.setInData(['selectedItemDetails', 'newContainerDefinition'], null);
          this.setInData(['selectedItemDetails', 'editContainerDefinition'], null);
          this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
                            listViewItems);
          this.emitChange();
        }
      }).catch(this.onGenericEditError);
    });
  },

  onRemoveContainerDefinition: function(containerDefinition) {
    var templateId = this.data.selectedItemDetails.documentId;
    var containerDescriptionLink = containerDefinition.documentSelfLink;

    services.deleteDocument(containerDescriptionLink).then(() => {
      return services.loadContainerTemplate(templateId);

    }).then((template) => {
      var index = template.descriptionLinks.indexOf(containerDescriptionLink);
      template.descriptionLinks.splice(index, 1);

      return services.updateContainerTemplate(template);

    }).then(() => {

      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {

        var listViewItems = this.data.selectedItemDetails.templateDetails.listView.items
          .asMutable();
        var newListViewItems = [];
        for (var i = 0; i < listViewItems.length; i++) {
          if (listViewItems[i].documentSelfLink !== containerDescriptionLink) {
            newListViewItems.push(listViewItems[i]);
          }
        }

        updateNetworksAndLinks.call(this, newListViewItems);
        updateVolumeLinks.call(this, newListViewItems);

        this.setInData(['selectedItemDetails', 'newContainerDefinition'], null);
        this.setInData(['selectedItemDetails', 'editContainerDefinition'], null);
        this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
          newListViewItems);
        this.emitChange();
      }
    }).catch(this.onContainerDescriptionDeleteError);
  },

  onSaveContainerDefinition: function(templateId, containerDefinition) {

    services.updateContainerDescription(containerDefinition).then((updatedDefinition) => {

      if (this.data.selectedItemDetails &&
        this.data.selectedItemDetails.documentId === templateId) {

        var listViewItems = this.data.selectedItemDetails.templateDetails.listView.items
          .asMutable({
            'deep': true
          });

        for (var i = 0, len = listViewItems.length; i < len; i += 1) {
          if (listViewItems[i].documentSelfLink === updatedDefinition.documentSelfLink) {
            listViewItems[i] = updatedDefinition;
          }
        }

        for (i = 0, len = listViewItems.length; i < len; i += 1) {
          _enhanceContainerDescription(listViewItems[i], listViewItems);
        }

        updateNetworksAndLinks.call(this, listViewItems);
        updateVolumeLinks.call(this, listViewItems);

        this.setInData(['selectedItemDetails', 'newContainerDefinition'], null);
        this.setInData(['selectedItemDetails', 'editContainerDefinition'], null);
        this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'items'],
                          listViewItems);
        this.emitChange();
      }
    }).catch(this.onGenericEditError);
  },

  onCancelContainerDefinitionEdit: function() {
    this.setInData(['selectedItemDetails', 'newContainerDefinition'], null);
    this.setInData(['selectedItemDetails', 'editContainerDefinition'], null);
    this.emitChange();
  },

  onResetContainerDefinitionEdit: function() {
    if (this.data.selectedItemDetails.newContainerDefinition &&
      this.data.selectedItemDetails.newContainerDefinition.definitionInstance) {
      this.setInData(['selectedItemDetails', 'newContainerDefinition',
        'definitionInstance'
      ], null);
    } else if (this.data.selectedItemDetails.editContainerDefinition) {
      this.setInData(['selectedItemDetails', 'editContainerDefinition'], null);
    } else {
      throw new Error('Requested to cancel container definition edit at unexpected state');
    }

    this.emitChange();
  },

  onSearchImagesForContainerDefinition: function(queryOptions) {
    var queryObjectsPath = ['selectedItemDetails', 'newContainerDefinition', 'listView',
      'queryOptions'
    ];

    if (queryOptions && !$.isEmptyObject(queryOptions)) {
      this.setInData(queryObjectsPath, queryOptions);
      searchImages.call(this, queryOptions, true, true);
    } else {
      this.setInData(queryObjectsPath, null);
      loadRecommended.call(this, true);
    }
  },

  onSelectImageForContainerDescription: function(imageId) {
    let calls = [];

    if (utils.isApplicationEmbedded()) {
      calls.push(services.loadDeploymentPolicies());
    }

    Promise.all(calls).then(([policies]) => {
      var definitionInstance = {
        image: imageId,
        name: utils.getDocumentId(imageId)
      };
      if (policies) {
        definitionInstance.deploymentPolicies = policies;
      }
      var containerDefs = utils.getIn(this.getData(), ['selectedItemDetails', 'templateDetails',
        'listView', 'items'
      ]);
      _enhanceContainerDescription(definitionInstance, containerDefs);
      this.setInData(['selectedItemDetails', 'newContainerDefinition',
                      'definitionInstance'], definitionInstance);
      var networks = utils.getIn(this.getData(),
                                 ['selectedItemDetails', 'templateDetails', 'listView',
                                  'networks']) || [];
      this.setInData(['selectedItemDetails', 'newContainerDefinition',
                      'definitionInstance', 'availableNetworks'],
                        getUserDefinedNetworkDescriptions(networks));

      var volumes = utils.getIn(this.getData(),
                        ['selectedItemDetails', 'templateDetails', 'listView', 'volumes'])
                    || [];
      this.setInData(['selectedItemDetails', 'newContainerDefinition',
                        'definitionInstance', 'availableVolumes'], volumes);

      this.emitChange();
    });
  },

  onCreateContainer: function(type, itemId) {
    var items = this.data.listView.items.asMutable();
    for (var i = 0; i < items.length; i++) {
      if (items[i].documentId === itemId) {
        items[i] = utils.setIn(items[i], ['provisioning'], true);
      }
    }

    this.setInData(['listView', 'items'], items);
    this.emitChange();

    var onContainerCreated = (request) => {
      var items = this.data.listView.items.asMutable();
      for (var i = 0; i < items.length; i++) {
        if (items[i].documentId === itemId) {
          items[i] = utils.setIn(items[i], ['provisioning'], false);
        }
      }

      this.setInData(['listView', 'items'], items);
      this.emitChange();

      this.openToolbarItem(constants.CONTEXT_PANEL.REQUESTS, RequestsStore.getData());
      actions.RequestsActions.requestCreated(request);
    };

    if (type === constants.TEMPLATES.TYPES.IMAGE) {
      var name = utils.getDocumentId(itemId);

      var containerDescription = {
        image: itemId,
        name: name,
        publishAll: true
      };

      services.createContainer(containerDescription).then((request) => {
        onContainerCreated(request);
      }).catch(this.onGenericCreateError);

    } else if (type === constants.TEMPLATES.TYPES.TEMPLATE) {

      services.createMultiContainerFromTemplate(itemId).then((request) => {
        onContainerCreated(request);
      }).catch(this.onGenericCreateError);
    }
  },

  onCreateContainerWithDetails: function(containerDescription) {
    services.createContainer(containerDescription).then((request) => {
      navigateTemplatesAndOpenRequests.call(this, request);
    }).catch(this.onGenericCreateError);
  },

  onCreateContainerTemplate: function(containerDescription) {
    services.createContainerTemplate(containerDescription).then((containerTemplate) => {
      var documentId = utils.getDocumentId(containerTemplate.documentSelfLink);
      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
        documentId);

    }).catch(this.onGenericCreateError);
  },

  onCreateKubernetesDeploymentTemplate: function(containerDescription) {
    services.createKubernetesDeploymentTemplate(containerDescription).then((containerTemplate) => {
      var documentId = utils.getDocumentId(containerTemplate.documentSelfLink);
      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
        documentId);
    }).catch(this.onGenericCreateError);
  },

  onProvisionKubernetesDeploymentTemplate: function(containerDescription) {
    services.createKubernetesDeploymentTemplate(containerDescription).then((containerTemplate) => {
      var documentId = utils.getDocumentId(containerTemplate.documentSelfLink);
      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
      documentId);

      var template = {
        'documentSelfLink': containerTemplate.documentSelfLink
      };

      this.onCopyTemplate(constants.TEMPLATES.TYPES.TEMPLATE, template);
    }).catch(this.onGenericCreateError);
  },

  onCreateClosureTemplate: function(closureDescription) {
    services.createClosureTemplate(closureDescription).then((closureTemplate) => {
      var documentId = utils.getDocumentId(closureTemplate.documentSelfLink);
      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
        documentId);

    }).catch(this.onGenericCreateError);
  },

  onOpenCreateNewTemplate: function(origin) {
    var detailsObject = {
      type: constants.TEMPLATES.TYPES.TEMPLATE,
      selectedForCreate: true,
      selectedForEdit: false,
      selectedForRequest: false,
      origin: origin
    };

    detailsObject.templateDetails = {};
    detailsObject.templateDetails.listView = {};

    this.setInData(['selectedItem'], detailsObject);
    this.setInData(['selectedItemDetails'], detailsObject);
    this.emitChange();
  },

  onCreateNewTemplate: function(templateName) {
    this.setInData(['isCreatingNewTemplate'], true);

    services.createNewContainerTemplate(templateName).then((template) => {
      var documentId = utils.getDocumentId(template.documentSelfLink);

      this.setInData(['isCreatingNewTemplate'], false);
      this.emitChange();

      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
                                                    documentId);
    }).catch((e) => {
      this.setInData(['isCreatingNewTemplate'], false);
      this.emitChange();

      this.onGenericCreateError(e);
    });


    this.emitChange();
  },

  onRemoveTemplate: function(templateId) {

    services.loadContainerTemplate(templateId).then((template) => {

      var containerDescriptionsToDeletePromises = [];
      for (let i = 0; i < template.descriptionLinks.length; i++) {
        containerDescriptionsToDeletePromises.push(
          services.deleteDocument(template.descriptionLinks[i]));
      }

      // Delete all container descriptions related to the template to be removed
      Promise.all(containerDescriptionsToDeletePromises).then(() => {
        // Remove the template itself
        services.removeContainerTemplate(templateId).then(() => {
          let queryOptions = this.selectFromData(['listView', 'queryOptions']).get();
          // Refresh view
          this.onOpenTemplates(queryOptions, true);

        }).catch(this.onTemplateRemoveError);
      }).catch(this.onContainerDescriptionDeleteError);
    });
  },

  onSaveTemplateName: function(templateId, templateName) {
    let templateLinkPrefix = links.COMPOSITE_DESCRIPTIONS + '/';

    let templateDocumentSelfLink = templateId;
    if (templateId.indexOf(templateLinkPrefix) === -1) {
      templateDocumentSelfLink = templateLinkPrefix + templateId;
    }

    let updateNameTemplateObj = {
      documentSelfLink: templateDocumentSelfLink,
      name: templateName
    };

    services.updateContainerTemplate(updateNameTemplateObj).then((template) => {
      // in case nothing is updated, the template is undefined
      if (template) {
        let templateId = template.documentSelfLink.substring(templateLinkPrefix.length);

        let selectedItemDetails = utils.getIn(this.getData(), ['selectedItemDetails']);
        if (selectedItemDetails && (selectedItemDetails.documentId === templateId)) {

          let templateDetails = utils.getIn(selectedItemDetails, ['templateDetails']);
          if (templateDetails) {

            this.setInData(['selectedItemDetails', 'templateDetails', 'name'], template.name);
            this.emitChange();
          }
        }
      }
    }).catch(this.onGenericEditError);
  },

  onCopyTemplate: function(type, template) {
    services.copyContainerTemplate(template, false).then((result) => {
      actions.TemplateActions.createContainer(type,
        utils.getDocumentId(result.documentSelfLink));
    }).catch(this.onGenericCreateError);
  },

  onPublishTemplate: function(templateId) {
    if (this.data.selectedItemDetails) {
      // we are in template details view
      this.setInData(['selectedItemDetails', 'alert'], null);
      this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'itemsLoading'],
        true);
    } else {
      // we are in main templates view
      this.setInData(['listView', 'itemsLoading'], true);
    }
    this.emitChange();

    let templateLinkPrefix = links.COMPOSITE_DESCRIPTIONS + '/';

    let templateDocumentSelfLink = templateId;
    if (templateId.indexOf(templateLinkPrefix) === -1) {
      templateDocumentSelfLink = templateLinkPrefix + templateId;
    }

    let publishedTemplateObj = {
      documentSelfLink: templateDocumentSelfLink,
      status: constants.TEMPLATES.STATUS.PUBLISHED
    };

    services.updateContainerTemplate(publishedTemplateObj).then(() => {
      handlePublishTemplate.call(this, templateDocumentSelfLink, {
        type: constants.ALERTS.TYPE.SUCCESS,
        message: i18n.t('app.template.publish.success')
      });
    }).catch((e) => {
      let errorMessage = utils.getErrorMessage(e);

      if (errorMessage && errorMessage._generic) {
        errorMessage = errorMessage._generic;
      } else {
        errorMessage = i18n.t('app.template.publish.fail');
      }

      handlePublishTemplate.call(this, templateDocumentSelfLink, {
        type: constants.ALERTS.TYPE.FAIL,
        message: errorMessage
      });
    });
  },

  onOpenImportTemplate: function() {
    this.setInData(['importTemplate', 'isImportingTemplate'], false);
    this.emitChange();
  },

  onImportTemplate: function(templateContent) {
    this.setInData(['importTemplate', 'error'], null);
    this.setInData(['importTemplate', 'isImportingTemplate'], true);
    this.emitChange();

    services.importContainerTemplate(templateContent).then((templateSelfLink) => {
      this.setInData(['importTemplate'], null);
      this.emitChange();

      var documentId = utils.getDocumentId(templateSelfLink);
      actions.NavigationActions.openTemplateDetails(constants.TEMPLATES.TYPES.TEMPLATE,
        documentId);
    }).catch(this.onImportTemplateError);
  },

  onImportTemplateError: function(e) {
    var validationErrors = utils.getValidationErrors(e);
    this.setInData(['importTemplate', 'error'], validationErrors);
    this.setInData(['importTemplate', 'isImportingTemplate'], false);
    this.emitChange();
  },

  onOpenToolbarRequests: function() {
    actions.RequestsActions.openRequests();
    this.openToolbarItem(constants.CONTEXT_PANEL.REQUESTS, RequestsStore.getData());
  },

  onCloseToolbar: function() {
    this.closeToolbar();
  },

  onGenericEditError: function(e) {
    var validationErrors = utils.getValidationErrors(e);

    var itemDetailsSelector = this.selectFromData(['selectedItemDetails']);
    var itemDetails = itemDetailsSelector.get();
    if (itemDetails) {
      for (var key in itemDetails) {
        if (!itemDetails.hasOwnProperty(key)) {
          continue;
        }
        var value = itemDetails[key];
        if (value && typeof value === 'object' && value.definitionInstance) {
          itemDetailsSelector.select([key, 'definitionInstance']).setIn(['error'],
            validationErrors);
        }
      }
    }

    this.emitChange();
  },

  onGenericCreateError: function(e) {
    this.onGenericEditError(e);
  },

  onTemplateRemoveError: function(e) {
    this.setInData(['listView', 'error'], utils.getErrorMessage(e));
    this.emitChange();
  },

  onContainerDescriptionDeleteError: function(e) {
    this.setInData(['selectedItemDetails', 'templateDetails', 'listView', 'error'],
      utils.getErrorMessage(e));
    this.emitChange();
  },

  loadAvailableRegistries: function() {
    services.loadRegistries().then((result) => {
      // currently selected project
      let selectedProject = utils.getSelectedProject();
      let selectedProjectKey;
      if (selectedProject) {
        if (utils.isApplicationEmbedded() && selectedProject.id) {
          selectedProjectKey = selectedProject.id;
        } else if (selectedProject.documentSelfLink) {
          selectedProjectKey = selectedProject.documentSelfLink;
        }
      }

      var availableRepositories = Object.values(result).filter((repository) => {
        if (!repository.tenantLinks || repository.tenantLinks.length === 0) {
          // global repository
          return true;
        } else {
          let projectLink = repository.tenantLinks.find(tenantLink => {
            return tenantLink === selectedProjectKey;
          });

          if (projectLink) {
            // project repository
            return true;
          }
        }
        // not configured for current project
        return false;
      });

      this.setInData(['listView', 'availableRepositories'], availableRepositories);
      this.emitChange();

    }).catch((error) => {
      console.error('Failed retrieving available repositories', error);
    });
  }
});

export default TemplatesStore;
