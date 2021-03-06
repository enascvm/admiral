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

import com.codeborne.selenide.Condition;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.PageValidator;

public class SourceRegistriesTabValidator extends PageValidator<SourceRegistriesTabLocators> {

    public SourceRegistriesTabValidator(By[] iFrameLocators,
            SourceRegistriesTabLocators pageLocators) {
        super(iFrameLocators, pageLocators);
    }

    public void validateRegistryExistsWithAddress(String address) {
        element(locators().registryRowByAddress(address)).should(Condition.exist);
    }

    public void validateRegistryDoesNotExistWithAddress(String address) {
        element(locators().registryRowByAddress(address)).shouldNot(Condition.exist);
    }

    @Override
    public void validateIsCurrentPage() {
        element(locators().sourceRegistriesButton()).shouldHave(Condition.cssClass("active"));
    }

}
