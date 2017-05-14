/**
 * @fileOverview Resources for testing.
 */

// NPM.
var _ = require('lodash');

// Local.
var ImageCloner = require('../../lib/imageCloner');

/**
 * Return a configuration object, overwriting its defaults with values passed
 * in.
 *
 * @param {Object} config Optional partial configuration with override values.
 * @return {Object} Configuration object.
 */
exports.getConfig = function (config) {
  // Add the required values that are not defaulted.
  config = _.extend({
    sourceImageId: 'image-id',
    sourceRegion: 'us-east-1',
    destinationRegions: ['eu-west-1']
  }, config);

  var imageCloner = new ImageCloner(config);

  return imageCloner.config;
};
