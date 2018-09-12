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

package com.vmware.admiral.test.ui.pages.clusters;

import static com.codeborne.selenide.Selenide.Wait;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.openqa.selenium.By;

import com.vmware.admiral.test.ui.pages.common.BasicPage;

public class ClustersPage extends BasicPage<ClustersPageValidator, ClustersPageLocators> {

    public ClustersPage(By[] iFrameLocators, ClustersPageValidator validator,
            ClustersPageLocators pageLocators) {
        super(iFrameLocators, validator, pageLocators);
    }

    public void clickAddClusterButton() {
        LOG.info("Adding a cluster/host");
        pageActions().click(locators().addClusterButton());
    }

    public void clickHostDeleteButton(String name) {
        LOG.info(String.format("Deleting host/cluster with name: [%s]", name));
        By card = locators().clusterCardByName(name);
        waitForElementToSettle(card);
        pageActions().click(locators().clusterContextMenuButtonByName(name));
        pageActions().click(locators().clusterDeleteButtonByName(name));
    }

    public void clickHostDetailsButton(String name) {
        LOG.info(String.format("Inspecting host/cluster with name: [%s]", name));
        By card = locators().clusterCardByName(name);
        waitForElementToSettle(card);
        pageActions().click(locators().clusterContextMenuButtonByName(name));
        pageActions().click(locators().clusterDetailsButton(name));
    }

    public void clickHostRescanButton(String name) {
        LOG.info(String.format("Rescaning host/cluster with name: [%s]", name));
        By card = locators().clusterCardByName(name);
        waitForElementToSettle(card);
        pageActions().click(locators().clusterContextMenuButtonByName(name));
        pageActions().click(locators().clusterRescanButtonByName(name));
    }

    public void waitForHostState(String name, int timeoutSeconds, HostState... states) {
        if (states.length == 0) {
            throw new IllegalArgumentException(
                    "You must provide at least one host state to wait for");
        }
        List<String> statusesStrings = Arrays.asList(states).stream().map(s -> s.toString())
                .collect(Collectors.toList());
        LOG.info(String.format(
                "Waiting [%d] seconds for host/cluster with name [%s] to become in %s state",
                timeoutSeconds, name, statusesStrings.toString().replaceAll(", ", " or ")));
        Wait().withTimeout(Duration.ofSeconds(timeoutSeconds))
                .until(d -> statusesStrings
                        .contains(pageActions().getText(locators().clusterStatusByName(name))));
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

    public static enum HostState {
        ON, UNKNOWN, WARNING, DISABLED, OFF
    }

}
