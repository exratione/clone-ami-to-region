/**
 * @fileOverview A configuration validator.
 */

// NPM.
var jsonschema = require('jsonschema');

/**
 * @class The ConfigValidator class.
 *
 * This validates the provided configuration.
 */
function ConfigValidator () {
  this.validator = new jsonschema.Validator();
  this.configSchema = {
    id: '/Config',
    type: 'object',
    additionalProperties: false,
    properties: {

      // ----------------------------------------------------------------------
      // Required.
      // ----------------------------------------------------------------------

      sourceImageId: {
        type: 'string',
        minLength: 1,
        required: true
      },

      sourceRegion: {
        type: 'string',
        minLength: 1,
        required: true
      },

      destinationRegions: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1
        },
        minItems: 1,
        required: true
      },

      // ----------------------------------------------------------------------
      // Optional for the user, but we require them internally; they are set
      // as defaults prior to the check on validity.
      // ----------------------------------------------------------------------

      progressCheckIntervalInSeconds: {
        type: 'number',
        minimum: 0,
        required: true
      },

      // ----------------------------------------------------------------------
      // Actually optional.
      // ----------------------------------------------------------------------

      clientOptions: {
        type: 'object',
        required: false
      }

    },
    required: true
  };
};

// --------------------------------------------------------------------------
// Methods.
// --------------------------------------------------------------------------

/**
 * Validate the provided configuration.
 *
 * @param {Object} config Configuration.
 * @return {Error[]} An array of errors.
 */
ConfigValidator.prototype.validate = function (config) {
  var result = this.validator.validate(config, this.configSchema) || {};
  return result.errors || [];
};

// --------------------------------------------------------------------------
// Exports constructor.
// --------------------------------------------------------------------------

module.exports = ConfigValidator;
