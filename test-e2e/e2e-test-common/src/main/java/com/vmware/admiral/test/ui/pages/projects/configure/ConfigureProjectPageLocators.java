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

package com.vmware.admiral.test.ui.pages.projects.configure;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.PageLocators;

public class ConfigureProjectPageLocators extends PageLocators {

    private static final By PAGE_TITLE = By.cssSelector(".projects-details-header-title");
    private final By MEMBERS_BUTTON = By.cssSelector("#membersTab");
    private final By PROJECT_REGISTRIES_BUTTON = By.cssSelector("#registryTab");

    public By pageTitle() {
        return PAGE_TITLE;
    }

    public By membersTabButton() {
        return MEMBERS_BUTTON;
    }

    public By projectRegistriesTabButton() {
        return PROJECT_REGISTRIES_BUTTON;
    }
}
