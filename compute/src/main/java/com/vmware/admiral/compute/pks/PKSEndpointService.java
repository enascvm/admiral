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

package com.vmware.admiral.compute.pks;

import java.net.URI;

import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.util.AssertUtil;
import com.vmware.admiral.common.util.PropertyUtils;
import com.vmware.photon.controller.model.resources.ResourceState;
import com.vmware.xenon.common.LocalizableValidationException;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceDocumentDescription;
import com.vmware.xenon.common.ServiceDocumentDescription.PropertyUsageOption;
import com.vmware.xenon.common.StatefulService;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.Utils;

public class PKSEndpointService extends StatefulService {

    public static final String FACTORY_LINK = ManagementUriParts.PKS_ENDPOINTS;

    public static class Endpoint extends ResourceState {
        public static final String FIELD_NAME_UAA_ENDPOINT = "uaaEndpoint";
        public static final String FIELD_NAME_API_ENDPOINT = "apiEndpoint";

        @Documentation(description = "UAA endpoint address")
        @UsageOption(option = PropertyUsageOption.REQUIRED)
        @UsageOption(option = PropertyUsageOption.AUTO_MERGE_IF_NOT_NULL)
        public String uaaEndpoint;

        @Documentation(description = "PKS API endpoint address")
        @UsageOption(option = PropertyUsageOption.REQUIRED)
        @UsageOption(option = PropertyUsageOption.AUTO_MERGE_IF_NOT_NULL)
        public String apiEndpoint;

        @Documentation(description = "Link to associated authentication credentials")
        public String authCredentialsLink;

    }

    public PKSEndpointService() {
        super(Endpoint.class);
        super.toggleOption(ServiceOption.PERSISTENCE, true);
        super.toggleOption(ServiceOption.REPLICATION, true);
        super.toggleOption(ServiceOption.OWNER_SELECTION, true);
    }

    @Override
    public void handleCreate(Operation op) {
        if (!checkForBody(op)) {
            return;
        }

        try {
            Endpoint endpoint = op.getBody(Endpoint.class);
            validate(endpoint);
            op.complete();
        } catch (Throwable e) {
            logSevere("Error creating PKS endpoint: %s. Error: %s", e.getMessage(),
                    Utils.toString(e));
            op.fail(e);
        }
    }

    @Override
    public void handlePatch(Operation op) {
        if (!checkForBody(op)) {
            return;
        }

        Endpoint currentState = getState(op);
        Endpoint patchBody = op.getBody(Endpoint.class);

        ServiceDocumentDescription docDesc = getDocumentTemplate().documentDescription;
        String currentSignature = Utils.computeSignature(currentState, docDesc);

        PropertyUtils.mergeServiceDocuments(currentState, patchBody);

        validate(currentState);

        String newSignature = Utils.computeSignature(currentState, docDesc);

        // if the signature hasn't change we shouldn't modify the state
        if (currentSignature.equals(newSignature)) {
            currentState = null;
            op.setStatusCode(Operation.STATUS_CODE_NOT_MODIFIED);
        }

        op.setBody(currentState).complete();
    }

    private void validate(Endpoint endpoint) {
        AssertUtil.assertNotNull(endpoint, "endpoint");
        AssertUtil.assertNotNullOrEmpty(endpoint.uaaEndpoint, "UAA endpoint");
        AssertUtil.assertNotNullOrEmpty(endpoint.apiEndpoint, "API endpoint");

        logInfo("Parsing uaa endpoint: %s", endpoint.uaaEndpoint);
        URI uri = URI.create(endpoint.uaaEndpoint);
        validateUri(uri);

        logInfo("Parsing api endpoint: %s", endpoint.apiEndpoint);
        uri = URI.create(endpoint.apiEndpoint);
        validateUri(uri);
    }

    private void validateUri(URI uri) {
        if (!UriUtils.HTTPS_SCHEME.equalsIgnoreCase(uri.getScheme())
                && !UriUtils.HTTP_SCHEME.equalsIgnoreCase(uri.getScheme())) {
            throw new LocalizableValidationException("Unsupported scheme: " + uri.getScheme(),
                    "common.unsupported.scheme", uri.getScheme());
        }
    }

}
