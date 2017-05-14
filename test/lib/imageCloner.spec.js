/**
 * @fileOverview Tests for lib/imageCloner.
 */

// NPM.
var _ = require('lodash');

// Local.
var constants = require('../../lib/constants');
var ImageCloner = require('../../lib/imageCloner');
var resources = require('../resources');

describe('lib/imageCloner', function () {
  var clonedImage;
  var config;
  var destinationRegion;
  var ec2;
  var image;
  var imageCloner;
  var launchPermissions;
  var sandbox;
  var sourceRegion;

  beforeEach(function () {
    config = resources.getConfig({
      progressCheckIntervalInSeconds: 0
    });
    sandbox = sinon.sandbox.create();

    image = {
      ImageId: config.sourceImageId,
      State: 'available',
      Name: 'name',
      Description: 'description',
      Tags: [
        {
          Key: 'key',
          Value: 'value'
        }
      ]
    };
    clonedImage = {
      ImageId: 'clonedImageId',
      State: 'available',
      Name: 'name',
      Description: 'description',
      Tags: []
    };

    sourceRegion = config.sourceRegion;
    destinationRegion = config.destinationRegions[0];

    launchPermissions = [
      {
        UserId: '111222333444',
        Group: 'all'
      }
    ];

    imageCloner = new ImageCloner(config);

    // Make sure we stub everything that is used.
    sandbox.stub(imageCloner.ec2, 'copyImage').yields(
      null,
      clonedImage.ImageId
    );
    sandbox.stub(imageCloner.ec2, 'describeImage').yields(
      null,
      clonedImage
    );
    sandbox.stub(imageCloner.ec2, 'describeImageAttribute').yields(
      null,
      launchPermissions
    );
    sandbox.stub(imageCloner.ec2, 'modifyImageAttribute').yields();
    sandbox.stub(imageCloner.ec2, 'tagImage').yields();

    // Suppress logging.
    sandbox.stub(console, 'error');
    sandbox.stub(console, 'info');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('awaitImageCopyCompletion', function () {
    var pendingImage;

    beforeEach(function () {
      pendingImage = _.extend({}, clonedImage, {
        State: 'pending'
      });

      imageCloner.ec2.describeImage.onCall(0).yields(null, pendingImage);
    });

    it('functions as expected', function (done) {
      imageCloner.awaitImageCopyCompletion(
        clonedImage.ImageId,
        destinationRegion,
        function (error) {
          sinon.assert.calledWith(
            imageCloner.ec2.describeImage,
            clonedImage.ImageId,
            destinationRegion,
            sinon.match.func
          );

          sinon.assert.calledTwice(imageCloner.ec2.describeImage);
          done(error);
        }
      );
    });

    it('calls back with error on error', function (done) {
      imageCloner.ec2.describeImage.onCall(1).yields(new Error());

      imageCloner.awaitImageCopyCompletion(
        clonedImage.ImageId,
        destinationRegion,
        function (error) {
          expect(error).to.be.instanceOf(Error);
          done();
        }
      );
    });
  });

  describe('cloneImageToRegion', function () {

    beforeEach(function () {
      sandbox.stub(imageCloner, 'awaitImageCopyCompletion').yields();
    });

    it('functions as expected', function (done) {
      imageCloner.cloneImageToRegion(
        image,
        launchPermissions,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          expect(imageId).to.equal(clonedImage.ImageId);

          sinon.assert.calledWith(
            imageCloner.ec2.copyImage,
            image.ImageId,
            image.Name,
            image.Description,
            sourceRegion,
            destinationRegion,
            sinon.match.func
          );
          sinon.assert.calledWith(
            imageCloner.awaitImageCopyCompletion,
            clonedImage.ImageId,
            destinationRegion,
            sinon.match.func
          );
          sinon.assert.calledWith(
            imageCloner.ec2.tagImage,
            clonedImage.ImageId,
            destinationRegion,
            image.Tags,
            sinon.match.func
          );
          sinon.assert.calledWith(
            imageCloner.ec2.modifyImageAttribute,
            clonedImage.ImageId,
            destinationRegion,
            constants.imageAttributes.LAUNCH_PERMISSION,
            {
              Add: launchPermissions
            },
            sinon.match.func
          );

          done(error);
        }
      );
    });

    it('yields error on error in copyImage', function (done) {
      imageCloner.ec2.copyImage.yields(new Error());

      imageCloner.cloneImageToRegion(
        image,
        launchPermissions,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          expect(error).to.be.instanceOf(Error);

          sinon.assert.notCalled(
            imageCloner.awaitImageCopyCompletion
          );
          sinon.assert.notCalled(
            imageCloner.ec2.tagImage
          );
          sinon.assert.notCalled(
            imageCloner.ec2.modifyImageAttribute
          );

          done();
        }
      );
    });

    it('yields error on error in awaitImageCopyCompletion', function (done) {
      imageCloner.awaitImageCopyCompletion.yields(new Error());

      imageCloner.cloneImageToRegion(
        image,
        launchPermissions,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          expect(error).to.be.instanceOf(Error);

          sinon.assert.notCalled(
            imageCloner.ec2.tagImage
          );
          sinon.assert.notCalled(
            imageCloner.ec2.modifyImageAttribute
          );

          done();
        }
      );
    });

    it('yields error on error in tagImage', function (done) {
      imageCloner.ec2.tagImage.yields(new Error());

      imageCloner.cloneImageToRegion(
        image,
        launchPermissions,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          expect(error).to.be.instanceOf(Error);

          sinon.assert.notCalled(
            imageCloner.ec2.modifyImageAttribute
          );

          done();
        }
      );
    });

    it('yields error on error in modifyImageAttribute', function (done) {
      imageCloner.ec2.modifyImageAttribute.yields(new Error());

      imageCloner.cloneImageToRegion(
        image,
        launchPermissions,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          expect(error).to.be.instanceOf(Error);
          done();
        }
      );
    });

  });

  describe('cloneImage', function () {

    beforeEach(function () {
      imageCloner.ec2.describeImage.yields(
        null,
        image
      );
      sandbox.stub(imageCloner, 'awaitImageCopyCompletion').yields();
      sandbox.stub(imageCloner, 'cloneImageToRegion').yields(
        null,
        clonedImage.ImageId
      );
    });

    it('functions as expected', function (done) {
      imageCloner.cloneImage(function (error, result) {
        expect(result).eql({
          'eu-west-1': {
            imageId: clonedImage.ImageId,
            success: true
          }
        });

        sinon.assert.calledWith(
          imageCloner.ec2.describeImage,
          image.ImageId,
          sourceRegion,
          sinon.match.func
        );
        sinon.assert.calledWith(
          imageCloner.ec2.describeImageAttribute,
          image.ImageId,
          sourceRegion,
          constants.imageAttributes.LAUNCH_PERMISSION,
          sinon.match.func
        );
        sinon.assert.calledWith(
          imageCloner.cloneImageToRegion,
          image,
          launchPermissions,
          sourceRegion,
          destinationRegion,
          sinon.match.func
        );

        done(error);
      });
    });

    it('yields error on error in describeImage', function (done) {
      imageCloner.ec2.describeImage.yields(new Error());

      imageCloner.cloneImage(function (error, result) {
        expect(error).is.instanceOf(Error);
        expect(result['eu-west-1'].success).equal(false);
        expect(result['eu-west-1'].error).is.instanceOf(Error);

        sinon.assert.notCalled(
          imageCloner.ec2.describeImageAttribute
        );
        sinon.assert.notCalled(
          imageCloner.cloneImageToRegion
        );

        done();
      });
    });

    it('yields error on error in describeImageAttribute', function (done) {
      imageCloner.ec2.describeImageAttribute.yields(new Error());

      imageCloner.cloneImage(function (error, result) {
        expect(error).is.instanceOf(Error);
        expect(result['eu-west-1'].success).equal(false);
        expect(result['eu-west-1'].error).is.instanceOf(Error);

        sinon.assert.notCalled(
          imageCloner.cloneImageToRegion
        );

        done();
      });
    });

    it('yields error on error in cloneImageToRegion', function (done) {
      imageCloner.cloneImageToRegion.yields(new Error());

      imageCloner.cloneImage(function (error, result) {
        expect(error).is.instanceOf(Error);
        expect(result['eu-west-1'].success).equal(false);
        expect(result['eu-west-1'].error).is.instanceOf(Error);

        done();
      });
    });
  });

  describe('fillConfigurationDefaults', function () {
    it('functions as expected', function () {
      expect(imageCloner.fillConfigurationDefaults({})).to.eql({
        progressCheckIntervalInSeconds: 30
      });
    });
  });
});
