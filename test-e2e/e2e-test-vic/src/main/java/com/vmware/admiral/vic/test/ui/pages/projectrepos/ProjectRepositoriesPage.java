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

package com.vmware.admiral.vic.test.ui.pages.projectrepos;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.BasicPage;

public class ProjectRepositoriesPage
        extends BasicPage<ProjectRepositoriesPageValidator, ProjectRepositoriesPageLocators> {

    public ProjectRepositoriesPage(By[] iFrameLocators, ProjectRepositoriesPageValidator validator,
            ProjectRepositoriesPageLocators pageLocators) {
        super(iFrameLocators, validator, pageLocators);
    }

    public void refresh() {
        LOG.info("Refreshing...");
        pageActions().click(locators().refreshButton());
        waitForSpinner();
    }

    @Override
    public void waitToLoad() {
        validate().validateIsCurrentPage();
        waitForSpinner();
    }

    public void selectRepositoryByName(String name) {
        LOG.info(String.format("Selecting repository [%s]", name));
        pageActions().click(locators().rowCheckboxByRepositoryName(name));
    }

    public void clickDeleteButton() {
        LOG.info("Clicking the delete button");
        pageActions().click(locators().deleteRepositoriesButton());
    }

}
