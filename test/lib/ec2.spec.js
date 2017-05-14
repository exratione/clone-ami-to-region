/**
 * @fileOverview Tests for EC2 utilities.
 */

// NPM.
var AWS = require('aws-sdk');

// Local.
var constants = require('../../lib/constants');
var Ec2 = require('../../lib/ec2');
var resources = require('../resources');

describe('lib/ec2', function () {
  var client;
  var config;
  var destinationImageId;
  var destinationRegion;
  var ec2;
  var image;
  var launchPermissions;
  var sandbox;
  var sourceRegion;

  beforeEach(function () {
    config = resources.getConfig();
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

    destinationImageId = 'destinationImageId';
    sourceRegion = config.sourceRegion;
    destinationRegion = config.destinationRegions[0];

    launchPermissions = [
      {
        UserId: '111222333444',
        Group: 'all'
      }
    ];

    ec2 = new Ec2(config);
    ec2.retryConfig.interval = 0;
    client = new AWS.EC2();

    // Make sure we stub everything that is used.
    sandbox.stub(client, 'copyImage').yields(null, {
      ImageId: destinationImageId
    });
    sandbox.stub(client, 'describeImages').yields(null, {
      Images: [
        image
      ]
    });
    sandbox.stub(client, 'describeImageAttribute').yields(null, {
      LaunchPermissions: launchPermissions
    });
    sandbox.stub(client, 'modifyImageAttribute').yields();
    sandbox.stub(client, 'createTags').yields();

    sandbox.stub(ec2, 'getClient').returns(client);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getClient', function () {

    beforeEach(function () {
      ec2.getClient.restore();
    });

    it('creates a client with implicit configuration', function () {
      expect(ec2.getClient(sourceRegion)).to.be.instanceOf(AWS.EC2);
    });

    it('creates a client with explicit configuration', function () {
      sandbox.spy(AWS, 'EC2');
      ec2.config.clientOptions = {
        maxRetries: 2
      };
      expect(ec2.getClient(sourceRegion)).to.be.instanceOf(AWS.EC2);
      sinon.assert.calledWith(
        AWS.EC2,
        {
          maxRetries: 2,
          region: sourceRegion
        }
      );
    });
  });

  describe('copyImage', function () {
    it('invokes copyImage with expected arguments', function (done) {
      ec2.copyImage(
        image.ImageId,
        image.name,
        image.descripion,
        sourceRegion,
        destinationRegion,
        function (error, data) {
          sinon.assert.calledWith(
            ec2.getClient,
            destinationRegion
          );
          sinon.assert.calledWith(
            client.copyImage,
            {
              Name: image.name,
              SourceImageId: image.ImageId,
              SourceRegion: sourceRegion,
              Description: image.descripion,
            },
            sinon.match.func
          );

          expect(data).to.eql(destinationImageId);
          done(error);
        }
      );
    });

    it('retries on failure', function (done) {
      client.copyImage.onCall(0).yields(new Error());

      ec2.copyImage(
        image.ImageId,
        image.name,
        image.descripion,
        sourceRegion,
        destinationRegion,
        function (error, data) {
          sinon.assert.calledTwice(client.copyImage);

          expect(data).to.eql(destinationImageId);
          done(error);
        }
      );
    });
  });

  describe('describeImage', function () {
    it('invokes describeImages with expected arguments', function (done) {
      ec2.describeImage(
        image.ImageId,
        sourceRegion,
        function (error, data) {
          sinon.assert.calledWith(
            ec2.getClient,
            sourceRegion
          );
          sinon.assert.calledWith(
            client.describeImages,
            {
              ImageIds: [image.ImageId]
            },
            sinon.match.func
          );

          expect(data).to.eql(image);
          done(error);
        }
      );
    });

    it('calls back with error if empty stacks array returned', function (done) {
      client.describeImages.yields(null, {
        Images: []
      });

      ec2.describeImage(
        image.ImageId,
        sourceRegion,
        function (error, data) {
          expect(error).to.be.instanceof(Error);
          done();
        }
      );
    });

    it('retries on failure', function (done) {
      client.describeImages.onCall(0).yields(new Error());

      ec2.describeImage(
        image.ImageId,
        sourceRegion,
        function (error, data) {
          sinon.assert.calledTwice(client.describeImages);

          expect(data).to.eql(image);
          done(error);
        }
      );
    });
  });

  describe('describeImageAttribute', function () {
    it('invokes describeImageAttribute with expected arguments', function (done) {
      ec2.describeImageAttribute(
        image.ImageId,
        sourceRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        function (error, data) {
          sinon.assert.calledWith(
            ec2.getClient,
            sourceRegion
          );
          sinon.assert.calledWith(
            client.describeImageAttribute,
            {
              Attribute: constants.imageAttributes.LAUNCH_PERMISSION,
              ImageId: image.ImageId
            },
            sinon.match.func
          );

          expect(data).to.eql(launchPermissions);
          done(error);
        }
      );
    });

    it('calls back with error for unsupported but valid attribute', function (done) {
      ec2.describeImageAttribute(
        image.ImageId,
        sourceRegion,
        'productCodes',
        function (error, data) {
          expect(error).to.be.instanceof(Error);
          done();
        }
      );
    });

    it('retries on failure', function (done) {
      client.describeImageAttribute.onCall(0).yields(new Error());

      ec2.describeImageAttribute(
        image.ImageId,
        sourceRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        function (error, data) {
          sinon.assert.calledTwice(client.describeImageAttribute);

          expect(data).to.eql(launchPermissions);
          done(error);
        }
      );
    });
  });

  describe('findImages', function () {
    var name;
    var description;

    beforeEach(function () {
      name = 'name',
      description = 'description';
    });

    it('invokes describeImages with expected arguments', function (done) {
      ec2.findImages(
        name,
        description,
        image.Tags,
        sourceRegion,
        function (error, data) {
          sinon.assert.calledWith(
            ec2.getClient,
            sourceRegion
          );
          sinon.assert.calledWith(
            client.describeImages,
            {
              Filters: [
                {
                  Name: 'description',
                  Values: [description]
                },
                {
                  Name: 'name',
                  Values: [name]
                },
                {
                  Name: 'tag:' + image.Tags[0].Key,
                  Values: [image.Tags[0].Value]
                }
              ]
            },
            sinon.match.func
          );

          expect(data).to.eql([image]);
          done(error);
        }
      );
    });

    it('retries on failure', function (done) {
      client.describeImages.onCall(0).yields(new Error());

      ec2.findImages(
        name,
        description,
        image.Tags,
        sourceRegion,
        function (error, data) {
          sinon.assert.calledTwice(client.describeImages);

          expect(data).to.eql([image]);
          done(error);
        }
      );
    });
  });

  describe('modifyImageAttribute', function () {
    var value;

    beforeEach(function () {
      value = {
        Add: {
          UserId: '111222333444',
          Group: 'all'
        }
      };
    });

    it('invokes modifyImageAttribute with expected arguments', function (done) {
      ec2.modifyImageAttribute(
        image.ImageId,
        sourceRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        value,
        function (error, data) {
          sinon.assert.calledWith(
            ec2.getClient,
            sourceRegion
          );
          sinon.assert.calledWith(
            client.modifyImageAttribute,
            {
              Attribute: constants.imageAttributes.LAUNCH_PERMISSION,
              ImageId: image.ImageId,
              LaunchPermission: value
            },
            sinon.match.func
          );

          done(error);
        }
      );
    });

    it('calls back with error for unsupported but valid attribute', function (done) {
      ec2.modifyImageAttribute(
        image.ImageId,
        sourceRegion,
        'productCodes',
        ['productCode'],
        function (error, data) {
          expect(error).to.be.instanceof(Error);
          done();
        }
      );
    });

    it('retries on failure', function (done) {
      client.modifyImageAttribute.onCall(0).yields(new Error());

      ec2.modifyImageAttribute(
        image.ImageId,
        sourceRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        value,
        function (error, data) {
          sinon.assert.calledTwice(client.modifyImageAttribute);
          done(error);
        }
      );
    });
  });

  describe('tagImage', function () {
    it('invokes createTags with expected arguments', function (done) {
      ec2.tagImage(
        image.ImageId,
        sourceRegion,
        image.Tags,
        function (error) {
          sinon.assert.calledWith(
            ec2.getClient,
            sourceRegion
          );
          sinon.assert.calledWith(
            client.createTags,
            {
              Resources: [image.ImageId],
              Tags: image.Tags
            },
            sinon.match.func
          );

          done(error);
        }
      );
    });

    it('retries on failure', function (done) {
      client.createTags.onCall(0).yields(new Error());

      ec2.tagImage(
        image.ImageId,
        sourceRegion,
        image.Tags,
        function (error) {
          sinon.assert.calledTwice(client.createTags);
          done(error);
        }
      );
    });
  });
});
