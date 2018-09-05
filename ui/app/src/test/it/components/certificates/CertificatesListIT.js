/*
 * Copyright (c) 2016-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

import services from 'core/services';
import InlineEditableListFactory from 'components/common/InlineEditableListFactory';
import CertificatesStore from 'stores/CertificatesStore';
import { CertificatesActions } from 'actions/Actions';
import sampleCertificates from 'it/helpers/certificates/sampleCertificates';

describe('Certificates management integration test', function() {
  var $container;

  var unspubscribeDataListener;
  var lastCertificatesData;
  var certificatesView;

  var createdCertificates = [];

  var SELF_SIGNED_URI = window.globals['cert.selfsigned.url'];
  var SELF_SIGNED_CN = window.globals['cert.selfsigned.cn'];
  var SELF_SIGNED_ISSUER = window.globals['cert.selfsigned.issuer'];

  beforeEach(function() {
    $container = $('<div>');
    $('body').append($container);

    createdCertificates = [];
    var realCreate = services.createCertificate;
    // intercepts the creation method
    spyOn(services, 'createCertificate').and.callFake(function(params) {
      return new Promise(function(resolve, reject) {
        realCreate.call(null, params)
          .then(function(createdCertificate) {
            createdCertificates.push(createdCertificate);
            resolve(createdCertificate);
          }).catch(reject);
      });
    });

    certificatesView = InlineEditableListFactory.createCertificatesList($container);

    unspubscribeDataListener = CertificatesStore.listen(function(certificatesData) {
      lastCertificatesData = certificatesData;
      certificatesView.setData(lastCertificatesData);
    });
  });

  afterEach(function(done) {
    $container.remove();

    unspubscribeDataListener();
    lastCertificatesData = null;

    var deletionPromises = [];
    createdCertificates.forEach(function(cert) {
      deletionPromises.push(services.deleteCertificate(cert));
    });

    Promise.all(deletionPromises).then(done);
  });

  it('it should create a certificate by providing the certificate in .PEM format', function(done) {
    CertificatesActions.retrieveCertificates();

    lastCertificatesData = null;

    testUtils.waitFor(function() {
      return lastCertificatesData && lastCertificatesData.items &&
          lastCertificatesData.items.length >= 0;
    }).then(function() {
      $container.find('.new-item').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.editingItemData;
      });
    }).then(function() {
      var certifcateInput =
          $container.find('.inline-edit .inline-edit-properties .certificate-input');
      console.log('Set the certificate. Inputs length: ' + certifcateInput.length);
      certifcateInput.val(sampleCertificates.defaultCertificate).trigger('change');

      // Trigger creation
      var certifcateSaveButton = $container.find('.inline-edit .inline-edit-save');
      console.log('Click save on button. Buttons length: ' + certifcateSaveButton.length);
      certifcateSaveButton.trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.newItem;
      });
    }).then(function() {
      expect(lastCertificatesData.newItem.commonName).toEqual('client');
      expect(lastCertificatesData.newItem.issuerName).toEqual('localhost');

      expect(lastCertificatesData.items).toContain(lastCertificatesData.newItem);

      done();
    });
  });

  // Note that this test may fail if the Admiral server has no access to SELF_SIGNED_URI
  // Disabled for further investigation: Fails on jobs at the stage:
  // waiting the certificate imported from url to be shown in the view
  xit('it should create a certificate by importing from URL', function(done) {
    console.log('START: it should create a certificate by importing from URL');
    console.log('    .. import from url', SELF_SIGNED_URI);
    CertificatesActions.retrieveCertificates();

    lastCertificatesData = null;
    testUtils.waitFor(function() {
      console.log('    .. opened certificates view');
      return lastCertificatesData && lastCertificatesData.items &&
          lastCertificatesData.items.length >= 0;
    }).then(function() {
      $container.find('.new-item').trigger('click');
      console.log('    .. click new item');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        console.log('    .. new item view');
        return lastCertificatesData && lastCertificatesData.editingItemData;
      });
    }).then(function() {
      console.log('    .. fill import url data');
      $container.find('.inline-edit .certificate-import-option-toggle').trigger('click');
      $container.find('.uri-input').val(SELF_SIGNED_URI);

      $container.find('.inline-edit .certificate-import-button').trigger('click');

      console.log('    .. waiting for import from url to finish', SELF_SIGNED_URI);

      return testUtils.waitFor(function() {
        var currentCertificate = $container.find(
            '.inline-edit .inline-edit-properties .certificate-input').val();

        console.log('    .. Loaded certificate from import url', currentCertificate);

        return currentCertificate && currentCertificate.indexOf(
            '-----BEGIN CERTIFICATE-----') !== -1;
      });
    }).then(function() {
      $container.find('.inline-edit .inline-edit-save').trigger('click');

      console.log('    .. saving the certificate imported from url');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.newItem;
      });
    }).then(function() {
      console.log('    .. check save success');
      expect(lastCertificatesData.newItem.commonName).toEqual(SELF_SIGNED_CN);
      expect(lastCertificatesData.newItem.issuerName).toEqual(SELF_SIGNED_ISSUER);

      expect(lastCertificatesData.items).toContain(lastCertificatesData.newItem);

      done();
    });
  });

  // Disabled as update uses HTTP PATCH, which seems PhantomJS 1.x has
  // issues with, does not send body.
  xit('it should create a certificate by providing the certificate in .PEM format and ' +
      'update it by importing from URL', function(done) {
    CertificatesActions.retrieveCertificates();

    lastCertificatesData = null;
    testUtils.waitFor(function() {
      return lastCertificatesData && lastCertificatesData.items &&
          lastCertificatesData.items.length >= 0;
    }).then(function() {
      $container.find('.new-item').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.editingItemData;
      });
    }).then(function() {
      $container.find(
          '.inline-edit .inline-edit-properties .certificate-input').val(
            sampleCertificates.defaultCertificate);

      $container.find('.inline-edit .inline-edit-save').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.newItem;
      });
    }).then(function() {

      var dataToSet = {
        items: lastCertificatesData.items
      };
      certificatesView.setData(dataToSet);

      var $newCertificateChildItem = $container.find('.item > .primary-cell[title="client"]');
      var $newCertificateItem = $newCertificateChildItem.closest('.item');

      $newCertificateItem.find('.table-actions .item-edit').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.editingItemData;
      });
    }).then(function() {

      $container.find('.inline-edit .certificate-import-option-toggle').trigger('click');
      $container.find('.uri-input').val(SELF_SIGNED_URI);

      var oldCertificate = $container.find(
          '.inline-edit .inline-edit-properties .certificate-input').val();

      $container.find('.inline-edit .certificate-import-button').trigger('click');

      return testUtils.waitFor(function() {
        var currentCertificate = $container.find(
            '.inline-edit .inline-edit-properties .certificate-input').val();
        return oldCertificate !== currentCertificate && currentCertificate &&
            currentCertificate.indexOf('-----BEGIN CERTIFICATE-----') !== -1;
      });
    }).then(function() {
      // Trigger creation
      $container.find('.inline-edit .inline-edit-save').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.updatedItem;
      });
    }).then(function() {
      expect(lastCertificatesData.updatedItem.commonName).toEqual(SELF_SIGNED_CN);
      expect(lastCertificatesData.updatedItem.issuerName).toEqual(SELF_SIGNED_ISSUER);

      expect(lastCertificatesData.items).toContain(lastCertificatesData.updatedItem);

      done();
    });
  });

  it('it should delete a certificate', function(done) {
    var testCertificate = {
      certificate: sampleCertificates.defaultCertificate
    };

    var createdCertificate;

    services.createCertificate(testCertificate)
    .then(function(_createdCertificate) {
      createdCertificate = _createdCertificate;

      CertificatesActions.retrieveCertificates();

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.items &&
            lastCertificatesData.items.length >= 0;
      });
    }).then(function() {
      var $itemsChild = $container.find('.item td[title="client"]');
      var $items = $itemsChild.closest('.item');

      var $actualItem;
      for (var i = 0; i < $items.length; i++) {
        var $currentItem = $($items[i]);
        if ($currentItem.data('entity').documentSelfLink === createdCertificate.documentSelfLink) {
          $actualItem = $currentItem;
          break;
        }
      }
      if (!$actualItem) {
        done.fail('Inable to find item with self link ' + createdCertificate.documentSelfLink);
        return;
      }

      $actualItem.find('.simple-cell .item-delete').trigger('click');

      // Need to confirm deletion
      $actualItem.find('.delete-inline-item-confirmation-confirm').trigger('click');

      lastCertificatesData = null;
      return testUtils.waitFor(function() {
        return lastCertificatesData && lastCertificatesData.items &&
            lastCertificatesData.items.length >= 0;
      });
    }).then(function() {
      for (var i = 0; i < lastCertificatesData.items.length; i++) {
        if (lastCertificatesData.items[i].documentSelfLink ===
            createdCertificate.documentSelfLink) {
          done.fail('Certificate with self link ' + createdCertificate.documentSelfLink +
              ' was expected to be deleted');
          return;
        }
      }

      services.loadCertificate(createdCertificate.documentSelfLink)
        .then(function() {
          done.fail('Load certificate was expected to fail with 404');
        }).catch(done);
    });
  });
});
