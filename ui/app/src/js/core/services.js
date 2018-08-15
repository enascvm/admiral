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

import constants from 'core/constants';
import utils from 'core/utils';
import links from 'core/links';
import ft from 'core/ft';
import { serviceUtils } from 'admiral-ui-common';

const IMAGES_SEARCH_QUERY_PROP_NAME = 'q';
const IMAGES_SEARCH_LIMIT_PROP_NAME = 'limit';
const IMAGES_SEARCH_QUERY_WILDCARD = '*';
const REGISTRY_FILTER_QUERY_PROP_NAME = 'registry';
const TEMPLATES_SEARCH_QUERY_TEMPLATES_ONLY_PARAM = 'templatesOnly';
const TEMPLATES_SEARCH_QUERY_TEMPLATES_PARENTS_ONLY_PARAM = 'templatesParentOnly';
const TEMPLATES_SEARCH_QUERY_IMAGES_ONLY_PARAM = 'imagesOnly';
const TEMPLATES_SEARCH_QUERY_CLOSURES_ONLY_PARAM = 'closuresOnly';
const TEMPLATE_DESCRIPTION_IMAGES_PARAM = 'descriptionImages';

const REQUEST_PARAM_VALIDATE_OPERATION_NAME = 'validate';

const CONTAINER_TYPE_DOCKER = 'DOCKER_CONTAINER';
const CONTAINER_HOST = 'CONTAINER_HOST';
const COMPOSITE_COMPONENT_TYPE = 'COMPOSITE_COMPONENT';
const NETWORK_TYPE = 'NETWORK';
const VOLUME_TYPE = 'CONTAINER_VOLUME';
const CLOSURE_TYPE = 'CLOSURE';

const DOCUMENT_TYPE_PROP_NAME = 'documentType';
const EXPAND_QUERY_PROP_NAME = 'expand';
const ODATA_COUNT_PROP_NAME = '$count';
const ODATA_FILTER_PROP_NAME = '$filter';
const ODATA_LIMIT_PROP_NAME = '$limit';
const ODATA_ORDERBY_PROP_NAME = '$orderby';
const DEFAULT_XENON_LIMIT = 10000;
const MAX_URL_CHAR_COUNT = 2000;

const PRAGMA_HEADER = 'pragma';
const PRAGMA_DIRECTIVE_FORCE_INDEX_UPDATE = 'xn-force-index-update';

const HEADER_PROJECT = 'x-project';

const FILTER_VALUE_ALL_FIELDS = 'ALL_FIELDS';

const CONTAINER_HOST_ID_CUSTOM_PROPERTY = '__containerHostId';
const DEFAULT_LIMIT = 20;

const DEBUG_SLOW_MODE_TIMEOUT = utils.getDebugSlowModeTimeout();
if (DEBUG_SLOW_MODE_TIMEOUT) {
  console.warn('DEBUG SLOW MODE ENABLED! Make sure you are running in dev/test mode.');
}

var ajax = function(method, url, data, headers, disableReloadOnUnauthorized, skipProjectHeader) {
  return new Promise(function(resolve, reject) {
    var fn = function() {
      $.ajax({
        method: method,
        url: utils.serviceUrl(url),
        dataType: 'json',
        headers: buildHeaders(headers, skipProjectHeader),
        data: data,
        contentType: 'application/json',
        statusCode: {
          403: function() {
            if (!disableReloadOnUnauthorized && window.notifySessionTimeout) {
              window.notifySessionTimeout();
            }
          },
          401: function() {
            if (!disableReloadOnUnauthorized && window.notifySessionTimeout) {
              window.notifySessionTimeout();
            }
          }
        },
        accepts: {
          json: 'application/json'
        }
      }).done(resolve)
        .fail((e) => {
        console.log(e);
        reject(e);
      });
    };

    if (DEBUG_SLOW_MODE_TIMEOUT) {
      var timeout = Math.round(DEBUG_SLOW_MODE_TIMEOUT * Math.random());
      setTimeout(fn, timeout);
    } else {
      fn();
    }
  });
};

var get = function(url, paramsData, skipProjectHeader) {
  return ajax('GET', url, paramsData, {}, false, skipProjectHeader);
};

var post = function(url, entity, skipProjectHeader) {
  return ajax('POST', url, JSON.stringify(entity), {}, false, skipProjectHeader);
};

var put = function(url, entity, skipProjectHeader) {
  return ajax('PUT', url, JSON.stringify(entity), {}, false, skipProjectHeader);
};

var patch = function(url, entity, skipProjectHeader) {
  return ajax('PATCH', url, JSON.stringify(entity), {}, false, skipProjectHeader);
};

var deleteEntity = function(url, skipProjectHeader) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'DELETE',
      url: utils.serviceUrl(url),
      data: JSON.stringify({}), // DCP expects empty object in the body to make a delete
      headers: buildHeaders({}, skipProjectHeader),
      contentType: 'application/json',
      dataType: 'text'
    }).done(resolve)
      .fail(reject);
  });
};

var buildHeaders = function(headers, skipProjectHeader) {
    if (!headers) {
    headers = {};
  }

  headers[PRAGMA_HEADER] = PRAGMA_DIRECTIVE_FORCE_INDEX_UPDATE;

  if (!skipProjectHeader) {
    let selectedProject = utils.getSelectedProject();
    if (selectedProject) {
      if (utils.isApplicationEmbedded() && selectedProject.id) {
        headers[HEADER_PROJECT] = selectedProject.id;
      } else if (selectedProject.documentSelfLink) {
        headers[HEADER_PROJECT] = selectedProject.documentSelfLink;
      }
    }
  }

  return headers;
};

var day2operation = function(url, entity) {
  return post(url, entity);
};

var buildTagsQuery = function(q) {
  var pair = q.split(constants.TAGS.SEPARATOR);
  var occurrence = pair[1] ? constants.SEARCH_OCCURRENCE.ALL : constants.SEARCH_OCCURRENCE.ANY;
  return serviceUtils.buildOdataQuery({
    key: [{
      val: '*' + serviceUtils.encodeQuotes(pair[0].toLowerCase()) + (pair[1] ? '' : '*'),
      op: 'eq'
    }],
    value: [{
      val: (pair[0] ? '' : '*') + serviceUtils
        .encodeQuotes((pair[1] || pair[0] || '').toLowerCase()) + '*',
      op: 'eq'
    }],
    [constants.SEARCH_OCCURRENCE.PARAM]: occurrence
  });
};

var makeDay2OperationRequestContainer = function(containerId, op) {
  return makeDay2OperationRequestContainers([containerId], op);
};

var makeDay2OperationRequestNetwork = function(networkId, op) {
  return makeDay2OperationRequestNetworks([networkId], op);
};

var makeDay2OperationRequestVolume = function(volumeId, op) {
  return makeDay2OperationRequestVolumes([volumeId], op);
};

var makeDay2OperationRequestCluster = function(clusterContainers, op) {
  var request = {};
  request.resourceType = CONTAINER_TYPE_DOCKER;
  let reslinks = [];
  for (let i = 0; i < clusterContainers.length; i++) {
    reslinks.push(clusterContainers[i].documentSelfLink);
  }
  request.resourceLinks = reslinks;
  request.operation = op;

  return request;
};

var makeDay2OperationRequestComposite = function(compositeId, op) {
  return makeDay2OperationRequestComposites([compositeId], op);
};

var batchDay2OperationResource = function(resourceType, resourceLinks, op) {
  var request = {};
  request.resourceType = resourceType;
  request.resourceLinks = resourceLinks;
  request.operation = op;

  return request;
};

var ensurePrefixResourceLinks = function(prefix, links) {
  let resourceLinks = [];

  links.forEach((link) => {
    if (link.indexOf(prefix) === -1) {
      resourceLinks.push(prefix + '/' + link);
    } else {
      resourceLinks.push(link);
    }
  });

  return resourceLinks;
};

var makeDay2OperationRequestContainers = function(containerLinks, op) {
  return batchDay2OperationResource(CONTAINER_TYPE_DOCKER,
            ensurePrefixResourceLinks(links.CONTAINERS, containerLinks), op);
};

var makeDay2OperationRequestClosures = function(closureLinks, op) {
  return batchDay2OperationResource(CLOSURE_TYPE,
            ensurePrefixResourceLinks(links.CLOSURES, closureLinks), op);
};

var makeDay2OperationRequestNetworks = function(networkLinks, op) {
  return batchDay2OperationResource(NETWORK_TYPE,
            ensurePrefixResourceLinks(links.CONTAINER_NETWORKS, networkLinks), op);
};

var makeDay2OperationRequestVolumes = function(volumeLinks, op) {
  return batchDay2OperationResource(VOLUME_TYPE,
            ensurePrefixResourceLinks(links.CONTAINER_VOLUMES, volumeLinks), op);
};

var makeDay2OperationRequestComposites = function(compositeComponentLinks, op) {
  return batchDay2OperationResource(COMPOSITE_COMPONENT_TYPE,
            ensurePrefixResourceLinks(links.COMPOSITE_COMPONENTS, compositeComponentLinks), op);
};

var makeDay2OperationRequestScale = function(descriptionLink, contextId,
                                               desiredNumberContainers) {
  // NOTE: desiredNumberContainers is the desired result number of containers in the cluster

  // NOTE: Currently the context id is the composition context id.
  // In case of single container type cluster we don't have context id

  var request = {};
  request.resourceType = CONTAINER_TYPE_DOCKER;
  request.resourceDescriptionLink = descriptionLink;
  request.resourceCount = desiredNumberContainers;
  request.customProperties = {
    __composition_context_id: contextId
  };
  request.operation = 'CLUSTER_RESOURCE';

  return request;
};

var calculateLimit = function() {
  var averageSize = 250;
  var h = $(document).height();
  var w = $(document).width();
  return Math.ceil(w / averageSize * h / averageSize) || DEFAULT_LIMIT;
};

var mergeUrl = function(path, params) {
  params = Object.keys(params).reduce((previous, current) => {
    let value = params[current];
    if (value !== undefined || value !== '') {
      previous[current] = value;
    }
    return previous;
  }, {});
  if (Object.keys(params)) {
    return path + '?' + $.param(params).replace(/\+/g, '%20');
  }
  return path;
};

var buildPaginationUrl = function(path, filter, count, order, limit, params) {
  params = $.extend(params || {}, {
    [DOCUMENT_TYPE_PROP_NAME]: true,
    [ODATA_COUNT_PROP_NAME]: count,
    [ODATA_LIMIT_PROP_NAME]: limit || calculateLimit(),
    [ODATA_ORDERBY_PROP_NAME]: order,
    [EXPAND_QUERY_PROP_NAME]: true
  });
  if (filter) {
    params[ODATA_FILTER_PROP_NAME] = filter;
  }
  return mergeUrl(path, params);
};

var buildQueryPaginationUrl = function(path, query, count, order, limit, params) {
  return buildPaginationUrl(path, buildSearchQuery(query), count, order, limit, params);
};

var list = function(url, expandQuery, paramsData, skipProjectHeader) {
  paramsData = paramsData || {};
  paramsData[DOCUMENT_TYPE_PROP_NAME] = true;
  if (expandQuery) {
    paramsData[EXPAND_QUERY_PROP_NAME] = true;
  }
  if (!paramsData[ODATA_LIMIT_PROP_NAME]) {
    paramsData[ODATA_LIMIT_PROP_NAME] = DEFAULT_XENON_LIMIT;
  }

  var callback = function(result) {
    // The result.documents check is added to support vRA.
    if (expandQuery && result.documentLinks && result.documents) {
      return result.documentLinks.reduce((previous, current) => {
        previous[current] = result.documents[current];
        return previous;
      }, {});
    } else {
      return result;
    }
  };

  var mergedUrl = mergeUrl(url, paramsData);
  // If the URL gets too long, send to long url get
  if (mergedUrl.length > MAX_URL_CHAR_COUNT) {
    var data = {
      uri: mergedUrl
    };
    return post(links.LONG_URI_GET, data, skipProjectHeader).then(callback);
  } else {
    return get(mergedUrl, null, skipProjectHeader).then(callback);
  }
};

var services = {};

services.createDocument = function(factoryLink, document) {
  return post(factoryLink, document);
};

services.loadDocument = function(documentSelfLink) {
  return get(documentSelfLink);
};

services.deleteDocument = function(documentSelfLink) {
  return deleteEntity(documentSelfLink);
};

services.patchDocument = function(documentSelfLink, diff) {
  return patch(documentSelfLink, diff);
};

services.updateDocument = function(documentSelfLink, document) {
  return put(documentSelfLink, document);
};

services.loadCredentials = function() {
  var oDataFilter = {};
  oDataFilter[ODATA_FILTER_PROP_NAME] = 'customProperties/scope ne \'SYSTEM\'';
  /*
  Explicitly not setting oData filter as it break CAFE -> DCP integration.
  The problem is that nested properties should be filtered by "/"
  (see filter section http://www.odata.org/documentation/odata-version-2-0/uri-conventions/)

  customProperties.scope ne 'SYSTEM' throws in CAFE: System request parameter
  $filter=customProperties.scope ne 'SYSTEM' is not properly formatted. Details:
  Unable to read expression with tokens: [[customProperties], [.], [scope]]

  customProperties/scope ne 'SYSTEM' throws in DCP: DCP error with Http code: [400]...
  it should be fixed on DCP level, the problem lies in
  com.vmware.xenon.common.ODataTokenizer.tokenize()
  */
  return list(links.CREDENTIALS, true);

};

services.loadCredential = function(id) {
  var prefixPath = links.CREDENTIALS + '/';

  var callParamId = id;
  if (!id.startsWith(prefixPath)) {
    callParamId = prefixPath + id;
  }

  return get(callParamId);
};

services.createCredential = function(credential) {
  return post(links.CREDENTIALS, credential);
};

services.updateCredential = function(credential) {
  return put(credential.documentSelfLink, credential);
};

services.deleteCredential = function(credential) {
  return deleteEntity(credential.documentSelfLink);
};

services.loadDeploymentPolicies = function(documentSelfLinks) {
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(links.DEPLOYMENT_POLICIES, true, params);
};

services.loadDeploymentPolicy = function(policyLink) {
  return get(policyLink);
};

services.createDeploymentPolicy = function(policy) {
  return post(links.DEPLOYMENT_POLICIES, policy);
};

services.updateDeploymentPolicy = function(policy) {
  return patch(policy.documentSelfLink, policy);
};

services.deleteDeploymentPolicy = function(policy) {
  return deleteEntity(policy.documentSelfLink);
};

services.createTag = function(tag) {
  return post(links.TAGS, tag);
};

services.loadTag = function(key, value) {
  return list(links.TAGS, true, {
    [ODATA_FILTER_PROP_NAME]: serviceUtils.buildOdataQuery({
      key: [{
        val: key,
        op: 'eq'
      }],
      value: [{
        val: value,
        op: 'eq'
      }]
    })
  }).then((result) => {
    return Object.values(result)[0];
  });
};

services.loadTags = function(documentSelfLinks) {
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(links.TAGS, true, params);
};

services.searchTags = function(q) {
  var params = {};
  if (q) {
    params[ODATA_FILTER_PROP_NAME] = '(' + buildTagsQuery(q) + ')';
  }
  return list(links.TAGS, true, params);
};

services.updateTagAssignment = function(tagAssignmentRequest) {
  return tagAssignmentRequest
      ? post(links.TAG_ASSIGNMENT, tagAssignmentRequest)
      : Promise.resolve({});
};

services.saveTagStates = function(tags) {
    if (tags === undefined || tags.length === 0) {
        return Promise.resolve(tags);
    }
    let request = {
      tagsToAssign: tags
    };
    return services.updateTagAssignment(request)
        .then((response) => Promise.resolve(response.tagLinks));
};

services.loadPlacementZones = function(documentSelfLinks) {
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  } else {
    // In Admiral filter non-COMPUTE only
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      'customProperties/__resourceType': [{
        val: constants.RESOURCE_TYPES.COMPUTE,
        op: 'ne'
      }],
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(links.EPZ_CONFIG, true, params);
};

services.loadPlacementZone = function(documentSelfLink) {
  return get(links.EPZ_CONFIG + documentSelfLink);
};

services.createPlacementZone = function(config) {
  return post(links.EPZ_CONFIG, config);
};

services.updatePlacementZone = function(config) {
  return patch(links.EPZ_CONFIG + config.documentSelfLink, config);
};

services.deletePlacementZone = function(config) {
  return deleteEntity(links.EPZ_CONFIG + config.documentSelfLink);
};

services.countHostsPerPlacementZone = function(resourcePoolLink, onlyContainerHosts, onlyComputes) {
  var queryOptions = {
    placementZone: resourcePoolLink
  };

  let params = {
    [DOCUMENT_TYPE_PROP_NAME]: true,
    [ODATA_COUNT_PROP_NAME]: true,
    [ODATA_FILTER_PROP_NAME]: buildHostsQuery(queryOptions, onlyContainerHosts, onlyComputes)
  };

  return get(mergeUrl(links.COMPUTE_RESOURCES, params)).then((result) => {
      return result.totalCount;
  });
};

services.loadCertificates = function() {
  return list(links.SSL_TRUST_CERTS, true);
};

services.loadCertificate = function(selfLink) {
  return get(selfLink);
};

services.importCertificate = function(hostUri, acceptCertificate) {
  var trustImportRequest = {
    hostUri: hostUri,
    acceptCertificate: acceptCertificate
  };

  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'PUT',
      url: utils.serviceUrl(links.SSL_TRUST_CERTS_IMPORT),
      data: JSON.stringify(trustImportRequest),
      headers: buildHeaders(),
      contentType: 'application/json',
      dataType: 'json',
      accepts: {
        json: 'application/json'
      }
    }).done(function(result, textStatus, request) {
      if (result) {
        // If the certificate is not imported and needs acceptance
        resolve(result, null);
      } else {
        // If the service was already imported, then we have a location header provider.
        // Otherwise it is signed by a known CA and does not need import.
        var certificateLocation = request.getResponseHeader('Location');
        resolve(null, certificateLocation);
      }
    }).fail(reject);
  });
};

services.createCertificate = function(certificate) {
  return post(links.SSL_TRUST_CERTS, certificate);
};

services.updateCertificate = function(certificate) {
  return patch(certificate.documentSelfLink, certificate);
};

services.deleteCertificate = function(certificate) {
  return deleteEntity(certificate.documentSelfLink);
};

services.addHost = function(host) {
  return put(links.CONTAINER_HOSTS, host);
};

services.autoConfigureHost = function(hostAutoConfigSpec) {
  var request = {};
  request.resourceType = 'CONFIGURE_HOST';
  request.operation = 'CONFIGURE_HOST';
  request.customProperties = hostAutoConfigSpec;

  return post(links.REQUESTS, request).then(function(createdRequest) {
    return createdRequest;
  });
};

services.createHostDescription = function(description) {
  return post(links.COMPUTE_DESCRIPTIONS, description);
};

services.createHost = function(hostDescription, clusterSize) {
  var request = {};
  request.resourceType = 'CONTAINER_HOST';
  request.operation = 'PROVISION_CONTAINER_HOSTS';
  request.resourceDescriptionLink = hostDescription.documentSelfLink;
  request.resourceCount = clusterSize;

  return post(links.REQUESTS, request);
};

services.validateHost = function(host) {
  return put(links.CONTAINER_HOSTS + '?' + REQUEST_PARAM_VALIDATE_OPERATION_NAME + '=true',
              host);
};

services.loadHost = function(hostId) {
  let selfLink = links.COMPUTE_RESOURCES + '/' + hostId;
  return this.loadHostsByLinks([selfLink]).then((result) => {
    return result[selfLink];
  });
};

services.loadHostByLink = function(hostLink) {
  return get(hostLink);
};

services.updateContainerHost = function(hostSpec) {
  return put(links.CONTAINER_HOSTS, hostSpec);
};

services.enableHost = function(hostId) {
  return patch(links.COMPUTE_RESOURCES + '/' + hostId, {
    'powerState': 'ON'
  });
};

services.disableHost = function(hostId) {
  return patch(links.COMPUTE_RESOURCES + '/' + hostId, {
    'powerState': 'SUSPEND'
  });
};

services.removeHost = function(hostId) {
  // this is second day op not CRUD
  var request = {};
  request.resourceType = CONTAINER_HOST;
  request.resourceLinks = [links.COMPUTE_RESOURCES + '/' + hostId];
  request.operation = 'REMOVE_RESOURCE';

  return day2operation(links.REQUESTS, request).then(function(removalRequest) {
    return removalRequest;
  });
};

services.loadHosts = function(queryOptions, onlyContainerHosts) {
  let filter = buildHostsQuery(queryOptions, onlyContainerHosts);
  let url = buildPaginationUrl(links.COMPUTE_RESOURCES, filter, true, 'creationTimeMicros asc');
  return get(url).then(function(result) {
    return result;
  });
};

services.loadHostsByLinks = function(documentSelfLinks) {
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(links.COMPUTE_RESOURCES, true, params);
};

services.searchHosts = function(query, limit) {
  var qOps = {
    any: query.toLowerCase(),
    powerState: 'ON'
  };

  let filter = buildHostsQuery(qOps, true);
  let url = buildPaginationUrl(links.COMPUTE_RESOURCES, filter, true,
                               'creationTimeMicros asc', limit);
  return get(url).then(function(data) {
    var documentLinks = data.documentLinks || [];

    var result = {
      totalCount: data.totalCount
    };

    result.items = documentLinks.map((link) => {
      return data.documents[link];
    });

    return result;
  });
};

services.loadClusters = function(query, limit) {
  var qOps = {
    any: query.toLowerCase(),
    powerState: 'ON'
  };

  var filter = buildHostsQuery(qOps, true);

  var params = $.extend(params || {}, {
    [DOCUMENT_TYPE_PROP_NAME]: true,
    [ODATA_COUNT_PROP_NAME]: true,
    [ODATA_LIMIT_PROP_NAME]: limit || calculateLimit(),
    [ODATA_ORDERBY_PROP_NAME]: 'creationTimeMicros asc',
    [EXPAND_QUERY_PROP_NAME]: true
  });

  if (filter) {
    params.$hostsFilter = filter;
  }
  var url = mergeUrl(links.CONTAINER_CLUSTERS, params);

  return get(url).then(function(data) {
    var documentLinks = data.documentLinks || [];

    var result = {
      totalCount: data.totalCount
    };

    result.items = documentLinks.map((link) => {
      return data.documents[link];
    });

    return result;
  });
};

services.loadNetwork = function(documentSelfLink) {
  return get(documentSelfLink);
};

services.loadImage = function(documentSelfLink) {
  return get(documentSelfLink);
};

services.loadNextPage = function(nextPageLink) {
  return get(nextPageLink + '&' + DOCUMENT_TYPE_PROP_NAME + '=true').then(function(result) {
    return result;
  });
};

services.loadImages = function(queryOptions) {
  if (!queryOptions) {
    queryOptions = {};
  }

  var anys = toArrayIfDefined(queryOptions.any);

  var params = {};
  if (anys) {
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = anys[0];
  } else {
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = IMAGES_SEARCH_QUERY_WILDCARD;
  }

  return list(links.IMAGES, false, params).then(function(data) {
    var results = data.results || [];
    results.sort(utils.templateSortFn);
    return results;
  });
};

services.loadImageIds = function(query, limit) {
  var params = {};
  params[IMAGES_SEARCH_QUERY_PROP_NAME] = query;
  params[IMAGES_SEARCH_LIMIT_PROP_NAME] = limit;
  params[TEMPLATES_SEARCH_QUERY_IMAGES_ONLY_PARAM] = true;

  return list(links.IMAGES, false, params).then(function(data) {
    var results = data.results || [];
    results.sort(utils.templateSortFn);
    var imageIds = [];
    for (var k in results) {
      if (results.hasOwnProperty(k)) {
        var image = results[k];
        imageIds.push(image.name);
      }
    }
    return imageIds;
  });
};

services.loadImageTags = function(imageName) {
  var params = {};
  params[IMAGES_SEARCH_QUERY_PROP_NAME] = imageName;

  return list(links.IMAGE_TAGS, false, params).then(function(tags) {
    return tags;
  });
};

services.loadTemplates = function(queryOptions) {
  if (!queryOptions) {
    queryOptions = {};
  }

  var params = {};

  if (queryOptions[REGISTRY_FILTER_QUERY_PROP_NAME]) {
    let registryName = queryOptions[REGISTRY_FILTER_QUERY_PROP_NAME];
    if (registryName.length > 0) {
      // search in a single registry and ignore others
      params[REGISTRY_FILTER_QUERY_PROP_NAME] = registryName;
    }
  }

  var anys = toArrayIfDefined(queryOptions.any);
  if (anys) {
    if (anys.length === 0) {
      // nothing to search for
      return {
        results: [],
        isPartialResult: false
      };
    }

    // TODO: there can be multiple query requests but we take only the first one, as the backend
    // does not handle multiple
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = anys[0];
  } else {
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = IMAGES_SEARCH_QUERY_WILDCARD;
  }

  let searchCategory = queryOptions[constants.SEARCH_CATEGORY_PARAM];
  if (searchCategory === constants.TEMPLATES.SEARCH_CATEGORY.TEMPLATES) {
    params[TEMPLATES_SEARCH_QUERY_TEMPLATES_ONLY_PARAM] = true;
    params[TEMPLATES_SEARCH_QUERY_TEMPLATES_PARENTS_ONLY_PARAM] = true;

  } else if (searchCategory === constants.TEMPLATES.SEARCH_CATEGORY.IMAGES) {
    params[TEMPLATES_SEARCH_QUERY_IMAGES_ONLY_PARAM] = true;
  }

  return list(links.TEMPLATES, false, params).then(function(data) {
    var results = data.results || [];
    var isPartialResult = data.isPartialResult || false;

    results.sort(utils.templateSortFn);

    return {
      results: results,
      isPartialResult: isPartialResult
    };
  });
};

services.loadTemplatesContainingComponentDescriptionLink = function(componentDescriptionLink) {
  var query = serviceUtils.buildOdataQuery({
    'descriptionLinks/item': [{
      val: componentDescriptionLink,
      op: 'eq'
    }]
  });

  return list(links.COMPOSITE_DESCRIPTIONS, true, {
    [ODATA_FILTER_PROP_NAME]: query
  });
};

services.loadTemplateClosures = function(queryOptions) {
  if (!queryOptions) {
    queryOptions = {};
  }

  var anys = toArrayIfDefined(queryOptions.any);

  var params = {};
  if (anys) {
    // TODO: there can be multiple query requests but we take only the first one, as the backend
    // does not handle multiple
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = anys[0];
  } else {
    params[IMAGES_SEARCH_QUERY_PROP_NAME] = IMAGES_SEARCH_QUERY_WILDCARD;
  }

  params[TEMPLATES_SEARCH_QUERY_CLOSURES_ONLY_PARAM] = true;

  console.log('Calling apo loadTemplateClosures: ' + JSON.stringify(queryOptions));
  return list(links.TEMPLATES, false, params).then(function(data) {
    return data.results || [];
  });
};

services.loadTemplateDescriptionImages = function(compositeDescriptionSelfLink) {
  var params = {};
  params[TEMPLATE_DESCRIPTION_IMAGES_PARAM] = true;
  return get(compositeDescriptionSelfLink, params);
};

services.loadRegistries = function(loadDefaultRegistry) {
    if (loadDefaultRegistry) {
        return list(links.REGISTRIES, true, null, true).then(registries => {
          return services.loadRegistry('/config/registries/default-registry').then(r => {
            registries[r.documentSelfLink] = r;
            return registries;
          }).catch(e => {
            console.log('Unable to load default registry.' + e);
            return registries;
          });
        });
    } else {
        return list(links.REGISTRIES, true, null, true);
    }
};

services.loadRegistry = function(documentSelfLink) {
  return get(documentSelfLink, null, true);
};

services.createOrUpdateRegistry = function(registry) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'PUT',
      url: utils.serviceUrl(links.REGISTRY_HOSTS),
      dataType: 'json',
      data: JSON.stringify(registry),
      headers: buildHeaders({}, true),
      contentType: 'application/json',
      accepts: {
        json: 'application/json'
      }
    }).done(function(data, status, xhr) {
      resolve([data, status, xhr]);
    }).fail(reject);
  });
};

services.validateRegistry = function(registry) {
  return put(links.REGISTRY_HOSTS + '?' + REQUEST_PARAM_VALIDATE_OPERATION_NAME + '=true',
      registry, true);
};

services.updateRegistry = function(registry) {
  return patch(registry.documentSelfLink, registry, true);
};

services.deleteRegistry = function(registry) {
  return deleteEntity(registry.documentSelfLink, true);
};

services.loadRequests = function() {
  return list(links.REQUESTS, true);
};

services.loadRequestByStatusLink = function(requestStatusLink) {
  let params = {
    [ODATA_FILTER_PROP_NAME]: serviceUtils.buildOdataQuery({
      requestTrackerLink: [{
        val: requestStatusLink,
        op: 'eq'
      }],
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    })
  };

  return get(mergeUrl(links.REQUESTS, params));
};

services.loadRequestStatuses = function(itemsType) {
  var params = {};

  if (itemsType === 'running') {
    params[constants.SEARCH_OCCURRENCE.PARAM] = constants.SEARCH_OCCURRENCE.ANY;
    params['taskInfo/stage'] = [{
      val: constants.REQUESTS.STAGES.CREATED,
      op: 'eq'
    }, {
      val: constants.REQUESTS.STAGES.STARTED,
      op: 'eq'
    }];
  }

  if (itemsType === 'failed') {
    params[constants.SEARCH_OCCURRENCE.PARAM] = constants.SEARCH_OCCURRENCE.ANY;
    params['taskInfo/stage'] = [{
      val: constants.REQUESTS.STAGES.FAILED,
      op: 'eq'
    }, {
      val: constants.REQUESTS.STAGES.CANCELLED,
      op: 'eq'
    }];
  }

  var filter = serviceUtils.buildOdataQuery(params);
  var url = buildPaginationUrl(links.REQUEST_STATUS, filter, false,
      'documentExpirationTimeMicros desc');
  return get(url).then(function(result) {
    return result;
  });
};

services.loadRequestStatus = function(requestTrackerLink) {
  return get(requestTrackerLink);
};

services.removeRequestStatus = function(requestStatusSelfLink) {
  var requestBrokerLink = links.REQUESTS + '/' + utils.getDocumentId(requestStatusSelfLink);
  return deleteEntity(requestBrokerLink);
};

services.loadRequestGraph = function(requestId, host) {
  var params = {
    'requestId': requestId
  };

  if (host) {
    params.xenonHost = host;
  }

  return list(links.REQUEST_GRAPH, false, params);
};

services.loadNotifications = function() {
  return get(links.NOTIFICATIONS);
};

services.loadPlacements = function() {
  var resourceType = constants.RESOURCE_TYPES.CONTAINER;

  var params = {
    [ODATA_FILTER_PROP_NAME]: serviceUtils.buildOdataQuery({
      resourceType: [{
        val: resourceType,
        op: 'eq'
      }],
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    })
  };

  return list(links.RESOURCE_GROUP_PLACEMENTS, true, params);
};

services.loadPlacement = function(documentSelfLink) {
  return get(documentSelfLink);
};

services.createPlacement = function(placement) {
  return post(links.RESOURCE_GROUP_PLACEMENTS, placement);
};

services.updatePlacement = function(placement) {
  return put(placement.documentSelfLink, placement);
};

services.deletePlacement = function(placement) {
  return deleteEntity(placement.documentSelfLink);
};

services.loadContainer = function(containerId) {
  return get(links.CONTAINERS + '/' + containerId);
};

services.manageContainer = function(containerId) {
  return get(links.CONTAINERS + '/' + containerId + links.MANAGE_CONTAINERS_ENDPOINT);
};

services.manageComposite = function(compositeId) {
  return get(links.COMPOSITE_COMPONENTS + '/' + compositeId + links.MANAGE_CONTAINERS_ENDPOINT);
};

services.manageNetwork = function(networkId) {
  return get(links.CONTAINER_NETWORKS + '/' + networkId + links.MANAGE_CONTAINERS_ENDPOINT);
};

services.manageVolume = function(volumeId) {
  return get(links.CONTAINER_VOLUMES + '/' + volumeId + links.MANAGE_CONTAINERS_ENDPOINT);
};

services.loadClosure = function(closureId) {
  return get(links.CLOSURES + '/' + closureId);
};

services.loadClosureDescriptionById = function(closureDescriptionId) {
  return get(links.CLOSURE_DESCRIPTIONS + '/' + closureDescriptionId);
};

services.loadContainers = function(queryOptions) {
  if (utils.isApplicationEmbedded()) {
    // this will build filter 'system ne true'
    queryOptions.system = 'true';
  }

  var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.CONTAINERS, filter, true, 'created asc');
  return get(url);
};

services.rescanContainers = function(queryOptions, numberOfContainers) {
  if (utils.isApplicationEmbedded()) {
      // this will build filter 'system ne true'
      queryOptions.system = 'true';
  }

  var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.CONTAINERS, filter, true, 'created asc', numberOfContainers);

  return get(url);
};

services.loadContainersForCompositeComponent = function(compositeComponentId) {
  let urlPrefix = links.COMPOSITE_COMPONENTS + '/';
  var compositeComponentLink = (compositeComponentId.indexOf(urlPrefix) > -1)
                                  ? compositeComponentId : urlPrefix + compositeComponentId;

  return services.loadContainers({compositeComponentLink: compositeComponentLink});
};

services.loadNetworksForCompositeComponent = function(compositeComponentId) {
  let urlPrefix = links.COMPOSITE_COMPONENTS + '/';
  var compositeComponentLink = (compositeComponentId.indexOf(urlPrefix) > -1)
                                  ? compositeComponentId : urlPrefix + compositeComponentId;

  return services.loadContainerNetworks({compositeComponentLinks: [compositeComponentLink]});
};

services.loadVolumesForCompositeComponent = function(compositeComponentId) {
  let urlPrefix = links.COMPOSITE_COMPONENTS + '/';
  var compositeComponentLink = (compositeComponentId.indexOf(urlPrefix) > -1)
    ? compositeComponentId : urlPrefix + compositeComponentId;

  return services.loadContainerVolumes({compositeComponentLinks: [compositeComponentLink]});
};

services.loadCompositeComponent = function(compositeComponentId) {
  return get(links.COMPOSITE_COMPONENTS + '/' + compositeComponentId);
};

services.loadCompositeComponents = function(queryOptions) {
  var filter = queryOptions ? buildResourcesSearchQuery(queryOptions) : '';
  let url = buildPaginationUrl(links.COMPOSITE_COMPONENTS, filter, true,
      'documentUpdateTimeMicros asc');
  return get(url);
};

services.loadCompositeComponentsByLinks = function(documentSelfLinks) {
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(links.COMPOSITE_COMPONENTS, true, params);
};

services.loadContainerNetworks = function(queryOptions) {
  var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.CONTAINER_NETWORKS, filter, true);
  return get(url);
};

services.loadContainerVolumes = function(queryOptions) {
  var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.CONTAINER_VOLUMES, filter, true);
  return get(url);
};

services.loadKubernetesEntities = function(queryOptions) {
  var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.KUBERNETES_ENTITIES, filter, true);
  return get(url);
};

services.loadContainerLogs = function(containerId, logsSettings) {
  return new Promise(function(resolve, reject) {
    var logRequestUriPath = links.CONTAINER_LOGS + '?id=' + containerId;
    if (logsSettings && logsSettings.option === constants.CONTAINERS.LOGS.OPTION.SINCE) {
      let sinceMs = logsSettings.sinceDuration;
      if (sinceMs) {
        var sinceSeconds = sinceMs / 1000;
        logRequestUriPath += '&timestamps=true&since=' + sinceSeconds;
      }
    } else if (logsSettings && logsSettings.option === constants.CONTAINERS.LOGS.OPTION.TAIL) {
        let tailLines = logsSettings.tailLines;
        if (tailLines) {
          logRequestUriPath += '&tail=' + tailLines;
        }
    }

    get(logRequestUriPath).then(function(logServiceState) {
      if (logServiceState && logServiceState.logs) {
        var decodedLogs = atob(logServiceState.logs);
        resolve(decodedLogs);
      } else {
        resolve('');
      }
    }).catch(reject);
  });
};

services.loadClosures = function(queryOptions) {
  // console.log('Calling service api: ' + links.CLOSURE_DESCRIPTIONS);
  // return list(links.CLOSURE_DESCRIPTIONS, true);
    var filter = buildResourcesSearchQuery(queryOptions);
  var url = buildPaginationUrl(links.CLOSURE_DESCRIPTIONS, filter, true);
  return get(url).then(function(result) {
    return result;
  });
};

services.loadClosureRuns = function(closureDescriptionLink) {
  // var filter = buildResourcesSearchQuery(queryOptions);
  let filter = serviceUtils.buildOdataQuery({
    descriptionLink: [{
      val: closureDescriptionLink + '*',
      op: 'eq'
    }],
    [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
  });
  let url = buildPaginationUrl(links.CLOSURES, filter, true);
  return get(url).then(function(result) {
    return result;
  });
};

services.getClosure = function(closureSelfLink) {
  return services.getClosureInstance(closureSelfLink).then(
    function(fetchedClosure) {

      console.log('Fetched closure instance.');

      return fetchedClosure;
    });
};

services.getClosureLogs = function(resourceLogLink) {
  return services.getLogs(resourceLogLink).then(
    function(fetchedLogs) {
      return fetchedLogs;
    });
};

services.createClosure = function(closureDescription) {
  return services.createdClosureDescription(closureDescription).then(
    function(createdClosureDescription) {
      console.log('Created closure description.'
       + createdClosureDescription.documentSelfLink);

      return createdClosureDescription;
    });
};

services.editClosure = function(closureDescription) {
  console.log('Service edit called: ' + JSON.stringify(closureDescription));
  return services.editClosureDescription(closureDescription).then(
    function(createdClosureDescription) {
      console.log('Edited closure description: ' + createdClosureDescription.documentSelfLink);

      return createdClosureDescription;
    });
};

services.deleteClosure = function(closureDescription) {
  return deleteEntity(closureDescription.documentSelfLink);
};

services.deleteClosureRun = function(closureSelfLink) {
  return deleteEntity(closureSelfLink);
};

services.runClosure = function(closureDescription, inputs) {
  return services.createClosureInstance(closureDescription).then(
  function(createdClosure) {
    console.log('Executing closure: ' + createdClosure.documentSelfLink);
    var closureRequest = {
      inputs: inputs
    };
    return services.runClosureInstance(createdClosure, closureRequest);
  });
};

services.createdClosureDescription = function(closureDescription) {
  return post(links.CLOSURE_DESCRIPTIONS, closureDescription);
};

services.editClosureDescription = function(closureDescription) {
  return patch(closureDescription.documentSelfLink, closureDescription);
};

services.createClosureInstance = function(closureDescription) {
  var closureState = {
    descriptionLink: closureDescription.documentSelfLink
  };
  return post(links.CLOSURES, closureState);
};

services.getClosureInstance = function(closureSelfLink) {
  return get(closureSelfLink);
};

services.loadClosureDescription = function(closureDescriptionSelfLink) {
  return get(closureDescriptionSelfLink);
};

services.getLogs = function(resourceId) {
  var resourceLogLink = links.CONTAINER_LOGS + '?id=' + resourceId;
  return get(resourceLogLink);
};

services.runClosureInstance = function(closureDescription, closureRequest) {
  return post(closureDescription.documentSelfLink, closureRequest);
};

services.createContainer = function(containerDescription, group) {
  return services.createContainerDescription(containerDescription).then(
    function(createdContainerDescription) {
      return services.createRequest(createdContainerDescription.documentSelfLink,
                            createdContainerDescription.tenantLinks, group, CONTAINER_TYPE_DOCKER);
    });
};

services.createNetwork = function(networkDescription, hostIds) {
  var customProperties = {};
  customProperties[CONTAINER_HOST_ID_CUSTOM_PROPERTY] = hostIds.join(',');
  return services.createNetworkDescription(networkDescription).then(
    function(createdNetworkDescription) {
      return services.createRequest(createdNetworkDescription.documentSelfLink,
                            createdNetworkDescription.tenantLinks, null, NETWORK_TYPE,
                            customProperties);
    });
};

services.createVolume = function(volumeDescription, hostIds) {
  var customProperties = {};
  customProperties[CONTAINER_HOST_ID_CUSTOM_PROPERTY] = hostIds.join(',');

  return services.createVolumeDescription(volumeDescription).then(
    function(createdVolumeDescription) {

      return services.createRequest(createdVolumeDescription.documentSelfLink,
        createdVolumeDescription.tenantLinks, null, VOLUME_TYPE,
        customProperties);
    });
};

services.createKubernetesEntities = function(entitiesContent, group) {
  return services.importContainerTemplate(entitiesContent).then(
    function(compositeDescriptionSelfLink) {
      return services.createRequest(compositeDescriptionSelfLink, null, group,
                                  COMPOSITE_COMPONENT_TYPE);
    });
};

services.startContainer = function(containerId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestContainer(containerId, 'Container.Start'))
    .then(function(startRequest) {
      return startRequest;
    });
};

services.stopContainer = function(containerId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestContainer(containerId, 'Container.Stop'))
    .then(function(stopRequest) {
      return stopRequest;
    });
};

services.removeContainer = function(containerId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestContainer(containerId, 'Container.Delete'))
    .then(function(deleteRequest) {
      return deleteRequest;
    });
};

services.removeNetwork = function(networkId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestNetwork(networkId, 'Network.Delete'))
    .then(function(deleteRequest) {
      return deleteRequest;
    });
};

services.removeVolume = function(volumeId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestVolume(volumeId, 'Volume.Delete'))
    .then(function(deleteRequest) {

      return deleteRequest;
    });
};

services.batchOpContainers = function(containerIds, operation) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestContainers(containerIds, operation))
    .then(function(day2OpRequest) {
      return day2OpRequest;
    });
};

services.batchOpClosures = function(closureIds, operation) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestClosures(closureIds, operation))
    .then(function(day2OpRequest) {
      return day2OpRequest;
    });
};

services.batchOpNetworks = function(networkIds, operation) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestNetworks(networkIds, operation))
    .then(function(day2OpRequest) {
      return day2OpRequest;
    });
};

services.batchOpVolumes = function(volumeIds, operation) {
  return day2operation(links.REQUESTS,

    makeDay2OperationRequestVolumes(volumeIds, operation))
      .then(function(day2OpRequest) {

      return day2OpRequest;
    });
};

services.startCompositeContainer = function(compositeId) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestComposite(compositeId, 'Container.Start'))
    .then(function(startRequest) {
      return startRequest;
    });
};

services.stopCompositeContainer = function(compositeId) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestComposite(compositeId, 'Container.Stop'))
    .then(function(stopRequest) {
      return stopRequest;
    });
};

services.removeCompositeContainer = function(compositeId) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestComposite(compositeId, 'Container.Delete'))
    .then(function(deleteRequest) {
      return deleteRequest;
    });
};

services.batchOpCompositeContainers = function(compositeIds, operation) {
  return day2operation(links.REQUESTS,
    makeDay2OperationRequestComposites(compositeIds, operation))
    .then(function(day2OpRequest) {
      return day2OpRequest;
    });
};

services.modifyClusterSize = function(descriptionLink, contextId, numberOfContainers) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestScale(descriptionLink, contextId, numberOfContainers))
    .then(function(clusteringRequest) {
      return clusteringRequest;
    });
};

services.startCluster = function(clusterContainers) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestCluster(clusterContainers, 'Container.Start'));
};

services.stopCluster = function(clusterContainers) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestCluster(clusterContainers, 'Container.Stop'));
};

services.removeCluster = function(clusterContainers) {

  return day2operation(links.REQUESTS,
    makeDay2OperationRequestCluster(clusterContainers, 'Container.Delete'));
};

services.createContainerTemplate = function(containerDescription) {

  return services.createContainerDescription(containerDescription)
    .then(function(createdContainerDescription) {
      var multiContainerDescription = {
        name: createdContainerDescription.name,
        descriptionLinks: [createdContainerDescription.documentSelfLink]
      };

      return post(links.COMPOSITE_DESCRIPTIONS, multiContainerDescription);
  });
};

services.createKubernetesDeploymentTemplate = function(containerDescription) {

  return services.createContainerDescription(containerDescription)
    .then(function(createdContainerDescription) {
      return services.convertContainerDescriptionToKubernetesDescription(
        createdContainerDescription)
          .then(function(kubernetesDescription) {
              var multiContainerDescription = {
                name: createdContainerDescription.name,
                descriptionLinks: [kubernetesDescription.documentSelfLink]
              };

              return post(links.COMPOSITE_DESCRIPTIONS, multiContainerDescription);
          });
    });
};

services.convertContainerDescriptionToKubernetesDescription = function(containerDescription) {
    return post(links.CONTAINER_DESCRIPTION_TO_KUBERNETES_DESCRIPTION_CONVERTER,
      containerDescription);
};

services.createContainerTemplateForDescription = function(name, descriptionLink) {
   var multiContainerDescription = {
      name: name,
      descriptionLinks: [descriptionLink]
    };

    return post(links.COMPOSITE_DESCRIPTIONS, multiContainerDescription);
};

services.createNewContainerTemplate = function(name) {
  var template = {
    name: name,
    descriptionLinks: []
  };

  return post(links.COMPOSITE_DESCRIPTIONS, template);
};

services.createClosureTemplate = function(closureDescription) {
    return services.createClosure(closureDescription)
      .then(function(createdClosureDescription) {
        var multiContainerDescription = {
          name: createdClosureDescription.name,
          descriptionLinks: [createdClosureDescription.documentSelfLink]
        };

        return post(links.COMPOSITE_DESCRIPTIONS, multiContainerDescription);
    });
};

services.removeContainerTemplate = function(templateId) {
  return deleteEntity(links.COMPOSITE_DESCRIPTIONS + '/' + templateId);
};

services.createMultiContainerFromTemplate = function(templateId, group) {
  return services.loadContainerTemplate(templateId).then((template) => {
    return services.createRequest(template.documentSelfLink, template.tenantLinks, group,
                                  COMPOSITE_COMPONENT_TYPE);
  });
};

services.createRequest = function(resourceDescriptionLink, tenantLinks, group, resourceType,
  customProperties) {

  var request = {};
  request.resourceType = resourceType;
  request.resourceDescriptionLink = resourceDescriptionLink;
  request.customProperties = customProperties;

  if (group) {
    if (tenantLinks) {
      let groupFound = tenantLinks.find((link) => {
        return link === group;
      });
      if (!groupFound) {
        tenantLinks.push(group);
        request.tenantLinks = tenantLinks;
      }
    } else {
      request.tenantLinks = [group];
    }
  } else {
    request.tenantLinks = tenantLinks;
  }

  return post(links.REQUESTS, request).then(function(createdRequest) {
    return createdRequest;
  });
};

services.loadContainerTemplates = function() {
  return list(links.COMPOSITE_DESCRIPTIONS, true);
};

services.loadContainerTemplate = function(documentId) {
  return get(links.COMPOSITE_DESCRIPTIONS + '/' + documentId);
};

services.updateContainerTemplate = function(template) {
  return patch(template.documentSelfLink, template);
};

services.copyContainerTemplate = function(template, reverse) {
  var target = links.COMPOSITE_DESCRIPTIONS_CLONE;
  if (reverse) {
    target += '?reverseParentLinks=true';
  }
  return post(target, template);
};

services.importContainerTemplate = function(template) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'POST',
      url: utils.serviceUrl(links.COMPOSITE_DESCRIPTIONS_CONTENT),
      data: template,
      contentType: 'application/yaml',
      headers: buildHeaders(),
      dataType: 'text',
      accepts: {
        yaml: 'application/yaml'
      }
    }).done(function(data, status, request) {
      var templateSelfLink = request.getResponseHeader('location');
      resolve(templateSelfLink);
    }).fail(reject);
  });
};

services.loadContainerDescription = function(containerDescriptionLink) {
  return get(containerDescriptionLink);
};

services.createContainerDescription = function(containerDescription) {
  return post(links.CONTAINER_DESCRIPTIONS, containerDescription);
};

services.updateContainerDescription = function(containerDescription) {
  return put(containerDescription.documentSelfLink, containerDescription);
};

services.loadNetworkDescription = function(networkDescriptionLink) {
  return get(networkDescriptionLink);
};

services.createNetworkDescription = function(networkDescription) {
  return post(links.CONTAINER_NETWORK_DESCRIPTIONS, networkDescription);
};

services.createVolumeDescription = function(volumeDescription) {
  return post(links.CONTAINER_VOLUMES_DESCRIPTIONS, volumeDescription);
};

services.searchContainerNetworks = function(query, limit) {
  return services.searchExternalEntities(links.CONTAINER_NETWORKS, query, limit);
};

services.searchContainerVolumes = function(query, limit) {
  return services.searchExternalEntities(links.CONTAINER_VOLUMES, query, limit);
};

services.searchExternalEntities = function(entityTypeLink, query, limit) {
  var filter = serviceUtils.buildOdataQuery({
    name: [{
      val: '*' + serviceUtils.encodeQuotes(query.toLowerCase()) + '*',
      op: 'eq'
    }],
    external: [{
      val: 'true',
      op: 'eq'
    }]
  });

  // Ideally we would order by name, but there is an issue with Xenon and various
  // services having name field, some of which are not marked as Sortable.
  let url = buildPaginationUrl(entityTypeLink, filter, true,
                                'documentUpdateTimeMicros desc', limit);

  return get(url).then(function(data) {
    var documentLinks = data.documentLinks || [];

    var result = {
      totalCount: data.totalCount
    };

    result.items = documentLinks.map((link) => {
      return data.documents[link];
    });

    return result;
  });
};

services.loadClusterContainers = function(descriptionLink, compositionContextId) {
  descriptionLink = (descriptionLink.indexOf(links.CONTAINER_DESCRIPTIONS) === -1)
                        ? links.CONTAINER_DESCRIPTIONS + '/' + descriptionLink
                        : descriptionLink;
  var params = {};
  let query = buildClusterQuery(descriptionLink, compositionContextId);
  if (query) {
    params[ODATA_FILTER_PROP_NAME] = query;
  }
  return list(links.CONTAINERS, true, params);
};

services.loadContainerStats = function(containerId) {
  return new Promise(function(resolve, reject) {
    var containerStatsPath = links.CONTAINER_STATS + '?id=' + containerId;
    get(containerStatsPath).then(function(serviceStats) {
       var val = serviceStats.entries;
       if (val) {
          var containerStats = {
              cpuUsage: val.cpuUsage ? val.cpuUsage.latestValue : 0,
              memLimit: val.memLimit ? val.memLimit.latestValue : 0,
              memUsage: val.memUsage ? val.memUsage.latestValue : 0,
              networkIn: val.networkIn ? val.networkIn.latestValue : 0,
              networkOut: val.networkOut ? val.networkOut.latestValue : 0
          };
          resolve(containerStats);
       } else {
          resolve(null);
       }
    }).catch(reject);
  });
};

services.loadEventLogs = function(itemsType) {
  var params = {};

  if (itemsType === 'warning') {
    params.eventLogType = [{
      val: constants.EVENTLOG.TYPE.WARNING,
      op: 'eq'
    }];
  }

  if (itemsType === 'error') {
    params.eventLogType = [{
      val: constants.EVENTLOG.TYPE.ERROR,
      op: 'eq'
    }];
  }

  var filter = serviceUtils.buildOdataQuery(params);
  var url = buildPaginationUrl(links.EVENT_LOGS, filter, false,
                                'documentExpirationTimeMicros desc');
  return get(url).then(function(result) {
    return result;
  });
};

services.clearEventLog = function() {
  return day2operation(links.DELETE_TASKS, {
    deleteDocumentKind: 'com:vmware:admiral:log:EventLogService:EventLogState'
  });
};

services.clearRequests = function() {
  return day2operation(links.DELETE_TASKS, {
    deleteDocumentKind: 'com:vmware:admiral:request:RequestStatusService:RequestStatus'
  });
};

services.getEventLogNotifications = function() {
  return get(links.NOTIFICATIONS);
};

services.removeEventLog = function(eventLogSelfLink) {
  return deleteEntity(eventLogSelfLink);
};

services.loadGroups = function() {
  return list(links.GROUPS);
};

services.loadProjects = function(queryOptions) {
  var filter = buildResourcesSearchQuery(queryOptions);
  var path = ft.showProjectsInNavigation() ? links.PROJECTS : links.RESOURCE_GROUPS;
  var url = buildPaginationUrl(path, filter, true);
  return get(url);
};

services.loadProject = function(projectLink) {
  return get(projectLink);
};

services.loadResourceGroups = function(documentSelfLinks) {
  var path = ft.showProjectsInNavigation() ? links.PROJECTS : links.RESOURCE_GROUPS;
  var params = {};
  if (documentSelfLinks && documentSelfLinks.length) {
    params[ODATA_FILTER_PROP_NAME] = serviceUtils.buildOdataQuery({
      documentSelfLink: documentSelfLinks.map((link) => {
        return {
          val: link,
          op: 'eq'
        };
      }),
      [constants.SEARCH_OCCURRENCE.PARAM]: constants.SEARCH_OCCURRENCE.ANY
    });
  }
  return list(path, true, params);
};

services.loadResourceGroup = function(groupLink) {
  return get(groupLink);
};

services.createResourceGroup = function(group) {
  var path = ft.showProjectsInNavigation() ? links.PROJECTS : links.RESOURCE_GROUPS;
  return post(path, group);
};

services.updateResourceGroup = function(group) {
  return patch(group.documentSelfLink, group);
};

services.deleteResourceGroup = function(group) {
  return deleteEntity(group.documentSelfLink);
};

services.loadCurrentUser = function() {
  return ajax('GET', links.USER_SESSION, {}, {}, true);
};

services.loadConfigurationProperties = function() {
  return list(links.CONFIG_PROPS, true);
};

services.importKubernetesDescriptions = function(content) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'POST',
      url: utils.serviceUrl(links.KUBERNETES_DESC_CONTENT),
      data: content,
      contentType: 'application/yaml',
      dataType: 'text',
      headers: buildHeaders(),
      accepts: {
        yaml: 'application/json'
      }
    }).done(function(data) {
      resolve(JSON.parse(data));
    }).fail(reject);
  });
};

services.getContainerShellUri = function(containerId) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'GET',
      url: utils.serviceUrl(links.CONTAINER_SHELL),
      dataType: 'text',
      data: {id: containerId},
      contentType: 'text/plain',
      headers: buildHeaders(),
      statusCode: {
        403: function() {
          window.location.reload(true);
        }
      }
    }).done(resolve)
      .fail(reject);
  });
};

services.login = function(username, password) {
  var data = JSON.stringify({
    requestType: 'LOGIN'
  });

  var headers = {
    Authorization: 'Basic ' + btoa(username + ':' + password)
  };

  return ajax('POST', links.BASIC_AUTH, data, headers, true);
};

services.logout = function() {
  return new Promise(function(resolve, reject) {
    $.ajax({
      method: 'GET',
      url: utils.serviceUrl(links.AUTH_LOGOUT),
      dataType: 'text'
    }).done(function(result, textStatus, request) {
      resolve(request.getResponseHeader('location'));
    }).fail(reject);
  });
};

services.triggerDataCollection = function() {
  return ajax('POST', links.DATA_COLLECTION, null, null, true);
};

services.loadPopularImages = function() {
  if (ft.areFavoriteImagesEnabled()) {
    var params = $.extend(params || {}, {
      [EXPAND_QUERY_PROP_NAME]: true,
      [DOCUMENT_TYPE_PROP_NAME]: true,
      [ODATA_LIMIT_PROP_NAME]: 1000
    });
    let url = mergeUrl(links.FAVORITE_IMAGES, params);

    return get(url, null, true);
  } else {
    return list(links.POPULAR_IMAGES);
  }
};

services.loadScript = function(src) {
  return new Promise((resolve, reject) => {
    $.getScript(src).done(resolve).fail(reject);
  });
};

services.addImageToFavorites = function(image) {
  return post(links.FAVORITE_IMAGES, image, true);
};

//this method encodes scheme, hostname and port parts of the given uri
// e.g. for given input like https://host:1234/path?p1=v2&p2=v2#fragment
// return: https%3A%2F%2Fhost%3A1234/path?p1=v2&p2=v2#fragment
// this could be used to prepare the url to pass as path fragment to (adapters) reverse proxy
services.encodeSchemeAndHost = function(uri) {
  var urlParts = utils.getURLParts(uri);
  var partToEncode = '';
  if (urlParts.scheme) {
    partToEncode = urlParts.scheme + ':';
  }
  if (urlParts.host) {
    partToEncode += urlParts.host;
  }
  if (urlParts.port) {
    partToEncode += ':' + urlParts.port;
  }

  var ret = '';
  if (partToEncode) {
    ret = encodeURIComponent(partToEncode);
  }
  if (urlParts.path) {
    ret += urlParts.path;
  }
  if (urlParts.query) {
    ret += '?' + urlParts.query;
  }
  if (urlParts.fragment) {
    ret += urlParts.fragment;
  }

  return ret;
};

var toArrayIfDefined = function(obj) {
  if ($.isArray(obj)) {
    return obj;
  } else if (obj) {
    return [obj];
  }

  return null;
};

var buildHostsQuery = function(queryOptions, onlyContainerHosts, onlyCompute) {
  let qOps = {};

  //Filter only actual compute hosts that are container hosts
  if (onlyContainerHosts === true) {
    qOps['customProperties/__computeContainerHost'] = [
      {
        op: 'eq',
        val: '*'
      }
    ];
  }

  if (onlyCompute === false) {
    qOps.type = [
      {
        op: 'eq',
        val: 'VM_GUEST'
      }
    ];
  }

  if (onlyCompute === true) {
    qOps[constants.SEARCH_OCCURRENCE.PARAM] = constants.SEARCH_OCCURRENCE.ANY;
    qOps.type = [{
      op: 'eq',
      val: 'VM_HOST'
    }, {
      op: 'eq',
      val: 'ZONE'
    }];
  }

  var result = '(' + serviceUtils.buildOdataQuery(qOps) + ')';

  if (queryOptions) {
    var userQueryOps = {};

    var anyArray = toArrayIfDefined(queryOptions.any);
    if (anyArray) {
      userQueryOps[FILTER_VALUE_ALL_FIELDS] = anyArray.map((any) => {
        return {
          val: '*' + serviceUtils.encodeQuotes(any.toLowerCase()) + '*',
          op: 'eq'
        };
      });
    }

    var documentIdArray = toArrayIfDefined(queryOptions.documentId);
    if (documentIdArray) {
      userQueryOps.documentSelfLink = documentIdArray.map((documentId) => {
        return {
          val: links.COMPUTE_RESOURCES + '/' + documentId,
          op: 'eq'
        };
      });
    }

    var addressArray = toArrayIfDefined(queryOptions.address);
    if (addressArray) {
      userQueryOps.address = addressArray.map((address) => {
        return {
          val: '*' + serviceUtils.encodeQuotes(address.toLowerCase()) + '*',
          op: 'eq'
        };
      });
    }

    var nameArray = toArrayIfDefined(queryOptions.name);
    if (nameArray) {
      userQueryOps.name = nameArray.map((name) => {
        return {
          val: '*' + serviceUtils.encodeQuotes(name.toLowerCase()) + '*',
          op: 'eq'
        };
      });
    }

    var typeArray = toArrayIfDefined(queryOptions.type);
    if (typeArray) {
      userQueryOps.type = typeArray.map((type) => {
        return {
          val: '*' + serviceUtils.encodeQuotes(type) + '*',
          op: 'eq'
        };
      });
    }

    var placementZoneArray = toArrayIfDefined(queryOptions.placementZone);
    if (placementZoneArray) {
      for (let i = 0; i < placementZoneArray.length; i++) {
        let prefixPath = links.PLACEMENT_ZONES + '/';
        let placementZoneId = placementZoneArray[i];
        if (placementZoneId.startsWith(prefixPath)) {
            placementZoneId = placementZoneId.slice(prefixPath.length);
        }
        userQueryOps.customProperties = [
          {
            val: constants.CUSTOM_PROPS.EPZ_NAME_PREFIX + placementZoneId,
            op: 'eq'
          }
        ];
      }
    }

    var placementArray = toArrayIfDefined(queryOptions.placement);
    if (placementArray) {
      userQueryOps['customProperties/__groupResourcePlacementLink'] =
          placementArray.map((placementId) => {
            return {
              val: placementId,
              op: 'eq'
            };
          });
    }

    var compositeContextIdArray = toArrayIfDefined(queryOptions.compositeContextId);
    if (compositeContextIdArray) {
      userQueryOps['customProperties/__composition_context_id'] =
          compositeContextIdArray.map((compositeContextId) => {
            return {
              val: compositeContextId,
              op: 'eq'
            };
          });
    }

    if (queryOptions.powerState) {
      userQueryOps.powerState = [{
        val: queryOptions.powerState.toUpperCase(),
        op: 'eq'
      }];
    }

    if (queryOptions.resourcePoolLink) {
      userQueryOps.resourcePoolLink = [{
        val: queryOptions.resourcePoolLink,
        op: 'eq'
      }];
    }

    var queryOptionsOccurrence = queryOptions[constants.SEARCH_OCCURRENCE.PARAM];
    if (queryOptionsOccurrence) {
      userQueryOps[constants.SEARCH_OCCURRENCE.PARAM] = queryOptionsOccurrence;
    }
    var userQueryOdata = serviceUtils.buildOdataQuery(userQueryOps);
    if (userQueryOdata) {
      result += ' and (' + userQueryOdata + ')';
    }
  }

  return result;
};

var buildClusterQuery = function(descriptionLink, compositionContextId) {
  let qOps = [];

  // Filter out Amazon parent hosts
  qOps.descriptionLink = [
    {
      op: 'eq',
      val: descriptionLink
    }
  ];

  if (compositionContextId) {
    qOps['customProperties/__composition_context_id'] = [
      {
        op: 'eq',
        val: compositionContextId
      }
    ];
  }

  return serviceUtils.buildOdataQuery(qOps);
};

var buildResourcesSearchQuery = function(queryOptions) {
  var newQueryOptions = {};
  if (queryOptions) {
    newQueryOptions[constants.SEARCH_OCCURRENCE.PARAM] =
      queryOptions[constants.SEARCH_OCCURRENCE.PARAM];

    var anyArray = toArrayIfDefined(queryOptions.any);
    if (anyArray) {
      newQueryOptions[FILTER_VALUE_ALL_FIELDS] = [];
      for (let i = 0; i < anyArray.length; i++) {
        newQueryOptions[FILTER_VALUE_ALL_FIELDS].push({
          val: '*' + anyArray[i].toLowerCase() + '*',
          op: 'eq'
        });
      }
    }

    var nameArray = toArrayIfDefined(queryOptions.name);
    if (nameArray) {
      var field = queryOptions[constants.SEARCH_CATEGORY_PARAM]
                  === constants.CONTAINERS.SEARCH_CATEGORY.CONTAINERS ? 'names/item' : 'name';
      newQueryOptions[field] = [];
      for (let i = 0; i < nameArray.length; i++) {
        newQueryOptions[field].push({
          val: '*' + nameArray[i].toLowerCase() + '*',
          op: 'eq'
        });
      }
    }

    var idArray = toArrayIfDefined(queryOptions.id);
    if (idArray) {
      newQueryOptions.id = [];
      for (let i = 0; i < idArray.length; i++) {
        newQueryOptions.id.push({
          val: idArray[i] + '*',
          op: 'eq'
        });
      }
    }

    var documentIdArray = toArrayIfDefined(queryOptions.documentId);
    if (documentIdArray) {
      newQueryOptions.documentSelfLink = [];

      var link;
      var category = queryOptions[constants.SEARCH_CATEGORY_PARAM];
      switch (category) {
        case constants.RESOURCES.SEARCH_CATEGORY.NETWORKS:
          link = links.CONTAINER_NETWORKS;
          break;
        case constants.RESOURCES.SEARCH_CATEGORY.VOLUMES:
          link = links.CONTAINER_VOLUMES;
          break;
        case constants.RESOURCES.SEARCH_CATEGORY.CLOSURES:
          link = links.CLOSURES;
          break;
        case constants.RESOURCES.SEARCH_CATEGORY.APPLICATIONS:
          link = links.COMPOSITE_COMPONENTS;
          break;
        case constants.RESOURCES.SEARCH_CATEGORY.PROJECTS:
          link = ft.showProjectsInNavigation() ? links.PROJECTS : links.RESOURCE_GROUPS;
          break;

        default:
        case constants.RESOURCES.SEARCH_CATEGORY.CONTAINERS:
          link = links.CONTAINERS;
          break;
      }

      for (let i = 0; i < documentIdArray.length; i++) {
        newQueryOptions.documentSelfLink.push({
          val: link + '/' + documentIdArray[i] + '*',
          op: 'eq'
        });
      }
    }

    var imageArray = toArrayIfDefined(queryOptions.image);
    if (imageArray) {
      newQueryOptions.image = [];
      for (let i = 0; i < imageArray.length; i++) {
        newQueryOptions.image.push({
          val: '*' + imageArray[i].toLowerCase() + '*',
          op: 'eq'
        });
      }
    }

    var parentIdArray = toArrayIfDefined(queryOptions.parentId);
    if (parentIdArray) {
      newQueryOptions.parentLink = [];
      for (let i = 0; i < parentIdArray.length; i++) {
        // We construct the parentLink to match '/resources/compute/id*'.
        newQueryOptions.parentLink.push({
          val: links.COMPUTE_RESOURCES + '/' + parentIdArray[i],
          op: 'eq'
        });
      }
    }

    var statusArray = toArrayIfDefined(queryOptions.status);
    if (statusArray) {
      // NOTE: the power state matching is case sensitive
      newQueryOptions.powerState = [];
      for (let i = 0; i < statusArray.length; i++) {
        newQueryOptions.powerState.push({
          val: '*' + statusArray[i].toUpperCase() + '*',
          op: 'eq'
        });
      }
    }

    var placementLinkArray = toArrayIfDefined(queryOptions.placement);
    if (placementLinkArray) {
      newQueryOptions.groupResourcePlacementLink = [];
      for (let i = 0; i < placementLinkArray.length; i++) {
        newQueryOptions.groupResourcePlacementLink.push({
          val: placementLinkArray[i] + '*',
          op: 'eq'
        });
      }
    }

    // used to view application's container list
    var compositeComponentLinkArray = toArrayIfDefined(queryOptions.compositeComponentLink);
    if (compositeComponentLinkArray) {
      newQueryOptions.compositeComponentLink = [];
      for (let i = 0; i < compositeComponentLinkArray.length; i++) {
        newQueryOptions.compositeComponentLink.push({
          val: compositeComponentLinkArray[i] + '*',
          op: 'eq'
        });
      }
    } else if (queryOptions[constants.SEARCH_CATEGORY_PARAM] ===
               constants.CONTAINERS.SEARCH_CATEGORY.CONTAINERS) {
      // TODO: issues with CAFE - all single provisioned containers have compositeComponentLink
      //      newQueryOptions.compositeComponentLink = [{
      //        val: '*',
      //        op: 'ne'
      //      }];

    }
    // In case of networks or other objects, they use a list of composite component links
    var compositeComponentLinksArray = toArrayIfDefined(queryOptions.compositeComponentLinks);
    if (compositeComponentLinksArray) {
      newQueryOptions['compositeComponentLinks/item'] = [];
      for (let i = 0; i < compositeComponentLinksArray.length; i++) {
        newQueryOptions['compositeComponentLinks/item'].push({
          val: compositeComponentLinksArray[i] + '*',
          op: 'eq'
        });
      }
    }

    var networkArray = toArrayIfDefined(queryOptions.network);
    if (networkArray) {
      newQueryOptions.networks = [];
      for (let i = 0; i < networkArray.length; i++) {
        newQueryOptions.networks.push({
          val: '*' + networkArray[i] + '*',
          op: 'eq'
        });
      }
    }

    var systemArray = toArrayIfDefined(queryOptions.system);
    if (systemArray) {
      newQueryOptions.system = [];
      for (let i = 0; i < systemArray.length; i++) {
        newQueryOptions.system.push({
          val: systemArray[i],
          op: 'ne'
        });
      }
    }
  }
  return serviceUtils.buildOdataQuery(newQueryOptions);
};

var buildSearchQuery = function(queryOptions) {

  if (!queryOptions) {
    return;
  }

  var userQueryOps = {};

  var anyArray = toArrayIfDefined(queryOptions.any);
  if (anyArray) {
    userQueryOps[FILTER_VALUE_ALL_FIELDS] = anyArray.map((any) => {
      return {
        val: '*' + any.toLowerCase() + '*',
        op: 'eq'
      };
    });
  }

  var nameArray = toArrayIfDefined(queryOptions.name);
  if (nameArray) {
    userQueryOps.name = nameArray.map((name) => {
      return {
        val: '*' + name.toLowerCase() + '*',
        op: 'eq'
      };
    });
  }

  var typeArray = toArrayIfDefined(queryOptions.type);
  if (typeArray) {
    userQueryOps.type = typeArray.map((type) => {
      return {
        val: '*' + type + '*',
        op: 'eq'
      };
    });
  }

  var networkArray = toArrayIfDefined(queryOptions.network);
  if (networkArray) {
    userQueryOps.networkLink = networkArray.map((network) => {
      return {
        val: network,
        op: 'eq'
      };
    });
  }

  var queryOptionsOccurrence = queryOptions[constants.SEARCH_OCCURRENCE.PARAM];
  if (queryOptionsOccurrence) {
    userQueryOps[constants.SEARCH_OCCURRENCE.PARAM] = queryOptionsOccurrence;
  }

  return serviceUtils.buildOdataQuery(userQueryOps);
};

var mcpClient = {
  buildQueryPaginationUrl: buildQueryPaginationUrl,
  delete: deleteEntity,
  get: get,
  patch: patch,
  post: post,
  put: put
};

window.constants = window.constants || {};

var adapterAPI = function(contentWindow, component, prepareFetchDataRequest) {
  return {
    contentWindow: contentWindow,
    component: component,
    fetchData: function(url, body) {
      if (!url.startsWith('/')) {
        url = '/' + url;
      }

      var fetchDataRequest = prepareFetchDataRequest(url, body);

      var urlToSend = '/adapter-extensibility/fetch-data' + url;

      return patch(urlToSend, fetchDataRequest);
    }, //fetchData
    notifyDirty: function() {
      this.component.onChange();
    }, //notifyDirty
    //title - the title to display for the message, or null.
    //msg - the message body.
    showError: function(title, msg) {
      alert('Error. title: ' + title
        + '\n' + msg);
    },
    showWarning: function(title, msg) {
      alert('Warning. title: ' + title
        + '\n' + msg);
    },
    showSuccess: function(title, msg) {
      alert('Success. title: ' + title
        + '\n' + msg);
    }
  };//return
};//adapterAPI

services.initHtmlEditor = function(frame, component, data, context, prepareFetchDataRequest) {
  var script = frame.contentWindow.document.createElement('script');
  //inject the iframe-resizer client lib
  script.setAttribute('src', '{host.uri}/ogui/lib/iframeResizer.contentWindow.min.js');
  frame.contentWindow.document.head.appendChild(script);

  window.iFrameResize({
    heightCalculationMethod: 'bodyScroll',
    initCallback: function(iframe) {
      try {
        iframe.contentWindow.context = context;
        iframe.contentWindow.adapterAPI = adapterAPI(
          iframe.contentWindow,
          component,
          prepareFetchDataRequest);
        iframe.contentWindow.init(data);
      } catch (err) {
        console.error('Cannot init editor. Cause: ' + err);
      }
    }
  }, frame);
};

services.mcpApi = {
  rest: mcpClient
};

window.mcp = window.mcp || {};
window.mcp.client = mcpClient;

export default services;
