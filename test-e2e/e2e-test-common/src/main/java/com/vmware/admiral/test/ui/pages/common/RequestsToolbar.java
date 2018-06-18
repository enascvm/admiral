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

import static com.codeborne.selenide.Selenide.Wait;

import java.util.concurrent.TimeUnit;

import com.codeborne.selenide.Condition;

import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;

public class RequestsToolbar extends BasicClass<RequestsToolbarLocators> {

    public RequestsToolbar(By[] iframeLocators, RequestsToolbarLocators pageLocators) {
        super(iframeLocators, pageLocators);
    }

    private final int WAIT_AFTER_REFRESH_ON_FAIL_SECONDS = 5;

    public void waitForLastRequestToSucceed(int timeout) {
        waitForLastRequestRequest(timeout, true);
    }

    public void waitForLastRequestToFail(int timeout) {
        waitForLastRequestRequest(timeout, false);
    }

    public void clickLastRequest() {
        pageActions().click(locators().lastRequest());
    }

    private void waitForLastRequestRequest(int timeout, boolean shouldSucceed) {
        String expectedState = shouldSucceed ? "succeed" : "fail";
        LOG.info(
                String.format("Waiting for [%d] seconds for the last request to %s", timeout,
                        expectedState));
        // Wait a little in case the request is not yet visible
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
        }
        try {
            if (shouldSucceed) {
                waitForLastToSucceed(timeout);
            } else {
                waitForLastToFail(timeout);
            }
        } catch (TimeoutException e) {
            // TODO maybe should not be necessary?
            LOG.warning(
                    "Timeout expired, refreshing requests to verify the request is not finished...");
            pageActions().click(locators().refreshButton());
            LOG.info(String.format(
                    "Waiting for additional [%s] seconds for the request to finish...",
                    WAIT_AFTER_REFRESH_ON_FAIL_SECONDS));
            try {
                if (shouldSucceed) {
                    waitForLastToSucceed(WAIT_AFTER_REFRESH_ON_FAIL_SECONDS);
                    LOG.info("Request has succeeded, proceeding...");
                } else {
                    waitForLastToFail(WAIT_AFTER_REFRESH_ON_FAIL_SECONDS);
                    LOG.info("Request has failed, proceeding...");
                }
            } catch (TimeoutException e1) {
                throw e;
            }
        }

    }

    private void waitForLastToSucceed(int timeout) {
        Wait().withTimeout(timeout, TimeUnit.SECONDS)
                .pollingEvery(1, TimeUnit.SECONDS)
                .until(f -> {
                    expandRequestsIfNotExpanded();
                    String text = pageActions().getText(locators().lastRequestProgress());
                    if (text.contains("FAILED")) {
                        throw new AssertionError(
                                "Last request failed, but was expected to succeed");
                    }
                    return text.contains("FINISHED")
                            && text.contains("COMPLETED");
                });
    }

    private void waitForLastToFail(int timeout) {
        Wait().withTimeout(timeout, TimeUnit.SECONDS)
                .pollingEvery(1, TimeUnit.SECONDS)
                .until(f -> {
                    expandRequestsIfNotExpanded();
                    String text = pageActions().getText(locators().lastRequestProgress());
                    if (text.contains("FINISHED") && text.contains("COMPLETED")) {
                        throw new AssertionError(
                                "Last request succeeded, but was expected to fail");
                    }
                    return text.contains("FAILED")
                            && text.contains("ERROR");
                });
    }

    private void expandRequestsIfNotExpanded() {
        if (!element(locators().lastRequestProgress()).is(Condition.visible)) {
            waitForElementToSettle(locators().requestsButton());
            if (!element(locators().lastRequestProgress()).is(Condition.visible)) {
                pageActions().click(locators().requestsButton());
            }
        }
    }

}
