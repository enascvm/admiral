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

import { Pipe, PipeTransform } from '@angular/core';
import { Utils } from "./utils";

@Pipe({ name: 'frequencyMeasurement' })
export class FrequencyMeasurementPipe implements PipeTransform {
    public transform(frequencyValue: any): string {
        if (!frequencyValue) {
            return '--';
        }

        let m = Utils.getFrequencyMagnitude(frequencyValue);
        let formattedHertz = Utils.formatHertz(frequencyValue, m);
        let unit = Utils.magnitudes[m] + 'Hz';
        return formattedHertz + unit;
    }
}
