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

package com.vmware.admiral.test.ui.pages.common;

import java.util.Objects;

import org.openqa.selenium.By;

public abstract class ResourcePageLibrary extends PageLibrary {

    public ResourcePageLibrary(By[] iframeLocators) {
        super(iframeLocators);
    }

    private RequestsToolbar requestsToolbar;
    private EventLogToolbar eventLogsToolar;

    public RequestsToolbar requests() {
        if (Objects.isNull(requestsToolbar)) {
            requestsToolbar = new RequestsToolbar(getFrameLocators(),
                    new RequestsToolbarLocators());
        }
        return requestsToolbar;
    }

    public EventLogToolbar logs() {
        if (Objects.isNull(eventLogsToolar)) {
            eventLogsToolar = new EventLogToolbar(getFrameLocators(),
                    new EventLogToolbarLocators());
        }
        return eventLogsToolar;
    }

}
