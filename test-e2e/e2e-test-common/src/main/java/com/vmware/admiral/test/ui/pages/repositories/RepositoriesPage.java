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

package com.vmware.admiral.test.ui.pages.repositories;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.ResourcePage;

public class RepositoriesPage
        extends ResourcePage<RepositoriesPageValidator, RepositoriesPageLocators> {

    public RepositoriesPage(By[] iFrameLocators, RepositoriesPageValidator validator,
            RepositoriesPageLocators pageLocators) {
        super(iFrameLocators, validator, pageLocators);
    }

    @Override
    public void refresh() {
        LOG.info("Refreshing...");
        pageActions().click(locators().refreshButton());
    }

    @Override
    public void waitToLoad() {
        validate().validateIsCurrentPage();
    }

    public void selectRegistry(String name) {
        LOG.info(String.format("Selecting registry with name [%s]", name));
        pageActions().click(locators().selectRepositoryDropdown());
        pageActions().click(locators().repositoryByName(name));
    }

    public void enterSearchCriteria(String searchCriteria) {
        LOG.info(String.format("Entering search criteria [%s]", searchCriteria));
        pageActions().clear(locators().searchInput());
        pageActions().sendKeys(searchCriteria + "\n", locators().searchInput());
        waitForSpinner();
    }

}
