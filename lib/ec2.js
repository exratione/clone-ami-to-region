/**
 * @fileOverview EC2 utility class definition.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var AWS = require('aws-sdk');
var _ = require('lodash');

// Local.
var constants = require('./constants');

// --------------------------------------------------------------------------
// Class definition.
// --------------------------------------------------------------------------

/**
 * @class EC2 utility class.
 *
 * @param {Object} config Configuration object.
 */
function Ec2 (config) {
  this.config = config;
  this.retryConfig = {
    times: 3,
    interval: 100
  };
}

// --------------------------------------------------------------------------
// Methods.
// --------------------------------------------------------------------------

/**
 * Obtain a client.
 */
Ec2.prototype.getClient = function (region) {
  // The AWS.EC2 client will be set here. It is exported for test purposes.
  //
  // Creation of the client is late and lazy because this helps with situations
  // in which you want to carry out different AWS actions with different
  // configurations in the same process. You can load this module up front and
  // it won't create the client until it is used.
  if (typeof this.config.clientOptions === 'object') {
    // Settings via config. Not recommended.
    return new AWS.EC2(_.extend({}, this.config.clientOptions, {
      region: region
    }));
  }
  else {
    // Assuming the setting of credentials via environment variable,
    // credentials file, role, etc.
    return new AWS.EC2({
      region: region
    });
  }
};

/**
 * Copy an image.
 *
 * @param {String} imageId The source image ID.
 * @param {String} name The name of the new image.
 * @param {String} description Description to apply to the new image.
 * @param {String} sourceRegion The source region.
 * @param {String} destinationRegion The destination region.
 * @param {Function} callback Of the form function (error, imageId).
 */
Ec2.prototype.copyImage = function (
  imageId,
  name,
  description,
  sourceRegion,
  destinationRegion,
  callback
) {
  var client = this.getClient(destinationRegion);
  var params = {
    Name: name,
    SourceImageId: imageId,
    SourceRegion: sourceRegion,
    //ClientToken: 'STRING_VALUE',
    Description: description,
    //DryRun: true || false,
    //Encrypted: true || false,
    //KmsKeyId: 'STRING_VALUE'
  };

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.copyImage(params, function (error, data) {
        if (error) {
          return retryCallback(new Error(util.format(
            'Call to copyImage failed: %s',
            error
          )));
        }

        retryCallback(null, data.ImageId);
      })
    },
    callback
  );
};

/**
 * Describe an image.
 *
 * @param {String} imageId The image ID.
 * @param {String} region The image region.
 * @param {Function} callback Of the form function (error, image).
 */
Ec2.prototype.describeImage = function (imageId, region, callback) {
  var client = this.getClient(region);
  var params = {
    ImageIds: [imageId]
  };

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.describeImages(params, retryCallback);
    },
    function (error, data) {
      if (error) {
        return callback(new Error(util.format(
          'Call to describeImages failed: %s',
          error
        )));
      }

      if (!data.Images.length) {
        return callback(new Error(util.format(
          'No image found for image ID %s.',
          imageId
        )));
      }

      callback(null, data.Images[0]);
    }
  );
};

/**
 * Describe one image attribute.
 *
 * @param {String} imageId The image ID.
 * @param {String} region The image region.
 * @param {String} attribute The attribute to describe.
 * @param {Function} callback Of the form function (error, data).
 */
Ec2.prototype.describeImageAttribute = function (
  imageId,
  region,
  attribute,
  callback
) {
  var client = this.getClient(region);
  var params = {
    Attribute: attribute,
    ImageId: imageId
  };

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.describeImageAttribute(params, retryCallback);
    },
    function (error, data) {
      if (error) {
        return callback(new Error(util.format(
          'Call to describeImageAttribute failed: %s',
          error
        )));
      }

      var property = constants.describeImageAttributesProperty[attribute];

      if (!property) {
        return callback(new Error(util.format(
          'Invalid or unsupported attribute for describeImageAttribute: %s',
          attribute
        )));
      }

      callback(null, data[property]);
    }
  );
};


/**
 * Find images by matching name, description, and tags.
 *
 * Tags has the form:
 *
 * [
 *   {
 *     Key: '',
 *     Value: ''
 *   },
 *   ...
 * ]
 *
 * @param {String} name The name.
 * @param {String} description The description.
 * @param {Object[]} tags The tags.
 * @param {String} region The image region.
 * @param {Function} callback Of the form function (error, object[]).
 */
Ec2.prototype.findImages = function (
  name,
  description,
  tags,
  region,
  callback
) {
  var client = this.getClient(region);
  var params = {
    Filters: [
      {
        Name: 'description',
        Values: [description]
      },
      {
        Name: 'name',
        Values: [name]
      }
    ]
  };

  _.each(tags, function (tag) {
    params.Filters.push({
      Name: 'tag:' + tag.Key,
      Values: [tag.Value]
    });
  });

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.describeImages(params, retryCallback);
    },
    function (error, data) {
      if (error) {
        return callback(new Error(util.format(
          'Call to describeImages failed: %s',
          error
        )));
      }

      callback(null, data.Images);
    }
  );
};

/**
 * Modify one image attribute.
 *
 * The value argument can vary considerably between attributes. For the
 * launchPermission type is is:
 *
 * {
 *   Add: [
 *     {
 *       UserId: '111222333444',
 *       Group: 'all'
 *     },
 *     ...
 *   ],
 *   Remove: [
 *     {
 *       UserId: '555666777888',
 *       Group: 'all'
 *     },
 *     ...
 *   ]
 * }
 *
 * @param {String} imageId The image ID.
 * @param {String} region The image region.
 * @param {String} attribute The attribute to modify.
 * @param {Mixed} value The update to apply to the attribute.
 * @param {Function} callback Of the form function (error).
 */
Ec2.prototype.modifyImageAttribute = function (
  imageId,
  region,
  attribute,
  value,
  callback
) {
  var client = this.getClient(region);
  var params = {
    Attribute: attribute,
    ImageId: imageId
  };
  var property = constants.modifyImageAttributesProperty[attribute];

  if (!property) {
    return callback(new Error(util.format(
      'Invalid or unsupported attribute for modifyImageAttribute: %s',
      attribute
    )));
  }

  params[property] = value;

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.modifyImageAttribute(params, retryCallback);
    },
    function (error, data) {
      if (error) {
        return callback(new Error(util.format(
          'Call to modifyImageAttribute failed: %s',
          error
        )));
      }

      callback();
    }
  );
};

/**
 * Tag an image.
 *
 * Tags have the form:
 *
 * [
 *   {
 *     Key: 'name',
 *     Value: 'value'
 *   },
 *   ...
 * ]
 *
 * @param {String} imageId The image ID.
 * @param {String} region The region.
 * @param {Object[]} tags Tags in the expected format.
 * @param {Function} callback Of the form function (error).
 */
Ec2.prototype.tagImage = function (
    imageId,
    region,
    tags,
    callback
) {
  var client = this.getClient(region);
  var params = {
    Resources: [imageId],
    Tags: tags
  };

  async.retry(
    this.retryConfig,
    function (retryCallback) {
      client.createTags(params, function (error) {
        if (error) {
          return retryCallback(new Error(util.format(
            'Call to createTags failed: %s',
            error
          )));
        }

        retryCallback();
      })
    },
    callback
  );
};

// --------------------------------------------------------------------------
// Exports constructor.
// --------------------------------------------------------------------------

module.exports = Ec2;
