/**
 * @fileOverview Main programmatic interface.
 */

// Local.
var ImageCloner = require('./lib/imageCloner');

/**
 * Clone the image. Yields a report on success or failure:
 *
 * {
 *   'eu-west-1': {
 *     imageId: 'ami-11223344',
 *     success: true
 *   },
 *   'us-west-2': {
 *     error: new Error(''),
 *     success: false
 *   },
 *   ...
 * }
 *
 * @param {Object} config Configuration object.
 * @param {Function} callback Of the form function (error, object).
 */
exports.cloneImage = function (config, callback) {
  var imageCloner = new ImageCloner(config);
  imageCloner.cloneImage(callback);
};
