/**
 * @fileOverview Class definition for the ImageCloner.
 */

// NPM.
var async = require('async');
var _ = require('lodash');

// Local.
var ConfigValidator = require('./configValidator');
var constants = require('./constants');
var Ec2 = require('./ec2');

/**
 * @class The ImageCloner class.
 *
 * This runs the copy of an AMI to one or more other regions.
 *
 * @param {Object} config Configuration object.
 */
function ImageCloner (config) {
  this.config = this.fillConfigurationDefaults(config);
  this.configValidator = new ConfigValidator();
  this.ec2 = new Ec2(this.config);
}

// -------------------------------------------------------------------------
// Methods.
// -------------------------------------------------------------------------

/**
 * Wait for an image copy to complete. Expect this to take a few minutes.
 *
 * @param {String} imageId The image ID.
 * @param {String} region The region.
 * @param {Function} callback callback Of the form function (error).
 */
ImageCloner.prototype.awaitImageCopyCompletion = function (
  imageId,
  region,
  callback
) {
  var self = this;
  var imageState;

  async.doUntil(
    function (asyncCallback) {
      setTimeout(function () {
        self.ec2.describeImage(imageId, region, function (error, image) {
          if (error) {
            return asyncCallback(error);
          }

          imageState = image.State;
          asyncCallback();
        });
      }, self.config.progressCheckIntervalInSeconds * 1000);
    },

    // Test function. Loops until this returns true or the async function above
    // errors.
    function () {
      return imageState && imageState !== 'pending';
    },

    callback
  );
}

/**
 * Clone an image to one destination region. Yields the ID of the cloned image.
 *
 * @param {Object} image The image data.
 * @param {Object[]} launchPermissions The image launch permissions.
 * @param {String} sourceRegion The source image region.
 * @param {String} destinationRegion The destination region.
 * @param {Function} callback Of the form function (error, imageId).
 */
ImageCloner.prototype.cloneImageToRegion = function (
  image,
  launchPermissions,
  sourceRegion,
  destinationRegion,
  callback
) {
  var self = this;
  var clonedImageId;

  async.series({
    copyImage: function (asyncCallback) {
      self.ec2.copyImage(
        image.ImageId,
        image.Name,
        image.Description,
        sourceRegion,
        destinationRegion,
        function (error, imageId) {
          clonedImageId = imageId;
          asyncCallback(error);
        }
      );
    },

    awaitCompletion: function (asyncCallback) {
      self.awaitImageCopyCompletion(
        clonedImageId,
        destinationRegion,
        asyncCallback
      );
    },

    tagImage: function (asyncCallback) {
      self.ec2.tagImage(
        clonedImageId,
        destinationRegion,
        image.Tags,
        asyncCallback
      );
    },

    setLaunchPermissions: function (asyncCallback) {
      self.ec2.modifyImageAttribute(
        clonedImageId,
        destinationRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        {
          Add: launchPermissions
        },
        asyncCallback
      );
    }
  }, function (error) {
    if (error) {
      return callback(error);
    }

    callback(null, clonedImageId);
  });
};

/**
 * Clone the image. Yields the new image IDs by region cloned to:
 *
 * {
 *   'eu-west-1': 'ami-11223344',
 *   ...
 * }
 *
 * @param {Object} config Configuration object.
 * @param {Function} callback Of the form function (error, object).
 */
ImageCloner.prototype.cloneImage = function (callback) {
  var self = this;
  var sourceImage;
  var sourceImageLaunchPermissions;
  var firstCloneImageError;
  var results = _.chain(
    self.config.destinationRegions
  ).keyBy(function (region) {
    return region;
  }).mapValues(function (item) {
    return {
      error: new Error('Cloning not attempted'),
      imageId: undefined,
      success: false,
    };
  }).value();

  async.series({
    // Validate the configuration we've been provided.
    validateConfig: function (asyncCallback) {
      var errors = self.configValidator.validate(self.config);
      if (errors.length) {
        asyncCallback(new Error(JSON.stringify(errors)));
      }
      else {
        asyncCallback();
      }
    },

    // Obtain the source image data.
    getImage: function (asyncCallback) {
      self.ec2.describeImage(
        self.config.sourceImageId,
        self.config.sourceRegion,
        function (error, image) {
          sourceImage = image;
          asyncCallback(error);
        }
      );
    },
    // Obtain the source image launch permissions.
    getImageLaunchPermissions: function (asyncCallback) {
      self.ec2.describeImageAttribute(
        self.config.sourceImageId,
        self.config.sourceRegion,
        constants.imageAttributes.LAUNCH_PERMISSION,
        function (error, launchPermissions) {
          sourceImageLaunchPermissions = launchPermissions;
          asyncCallback(error);
        }
      );
    },

    cloneImageToRegions: function (asyncCallback) {
      async.each(
        self.config.destinationRegions,
        function (destinationRegion, innerAsyncCallback) {
          self.cloneImageToRegion(
            sourceImage,
            sourceImageLaunchPermissions,
            self.config.sourceRegion,
            destinationRegion,
            // Don't fail immediately, let all run through, building up a
            // report.
            function (error, clonedImageId) {
              if (error) {
                firstCloneImageError = firstCloneImageError || error;
                results[destinationRegion].error = error;
                return innerAsyncCallback();
              }

              results[destinationRegion] = {
                success: true,
                imageId: clonedImageId
              };
              asyncCallback();
            }
          );

        },
        function () {
          asyncCallback(firstCloneImageError);
        }
      );
    }
  }, function (error) {
    callback(error, results);
  });
};

/**
 * Fill out the configuration object with default values.
 *
 * @param {Object} config Configuration.
 * @param {Object} Configuration with defaults set.
 */
ImageCloner.prototype.fillConfigurationDefaults = function (config) {
  return _.defaults(config, {
    progressCheckIntervalInSeconds: 30
  });
};

// --------------------------------------------------------------------------
// Exports constructor.
// --------------------------------------------------------------------------

module.exports = ImageCloner;
