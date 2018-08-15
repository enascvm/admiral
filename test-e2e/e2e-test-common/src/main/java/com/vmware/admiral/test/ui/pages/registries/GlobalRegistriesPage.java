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

package com.vmware.admiral.test.ui.pages.registries;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.BasicPage;

public class GlobalRegistriesPage
        extends BasicPage<GlobalRegistriesPageValidator, GlobalRegistriesPageLocators> {

    public GlobalRegistriesPage(By[] iFrameLocators, GlobalRegistriesPageValidator validator,
            GlobalRegistriesPageLocators pageLocators) {
        super(iFrameLocators, validator, pageLocators);
    }

    public void clickSourceRegistriesButton() {
        LOG.info("Navigating to Source Registries tab");
        pageActions().click(locators().sourceRegistriesButton());
    }

    @Override
    public void waitToLoad() {
        validate().validateIsCurrentPage();
    }

}
