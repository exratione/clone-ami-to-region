/**
 * @fileOverview Tests for the configuration validator.
 */

// Local.
var ConfigValidator = require('../../lib/configValidator');
var resources = require('../resources');

describe('lib/configValidator', function () {
  var config;
  var configValidator;
  var errors;

  function run (property, value, shouldError) {
    config = resources.getConfig();
    config[property] = value;
    errors = configValidator.validate(config);
    if (shouldError) {
      expect(errors.length).to.be.above(0);
    }
    else {
      expect(errors.length).to.equal(0);
    }
  }

  function shouldAccept (property, value) {
    run(property, value, false);
  }

  function shouldReject (property, value) {
    run(property, value, true);
  }

  beforeEach(function () {
    configValidator = new ConfigValidator();
  });

  it('validates correct configuration', function () {
    config = resources.getConfig();
    errors = configValidator.validate(config);
    expect(errors).to.eql([]);
  });

  it('rejects invalid configurations, accepts valid configurations', function () {
    shouldReject('sourceImageId', undefined);
    shouldReject('sourceImageId', '');
    shouldAccept('sourceImageId', 'ami-id');

    shouldReject('sourceRegion', undefined);
    shouldReject('sourceRegion', '');
    shouldAccept('sourceRegion', 'us-east-1');

    shouldReject('destinationRegions', undefined);
    shouldReject('destinationRegions', []);
    shouldAccept('destinationRegions', ['us-east-1']);
    shouldAccept('destinationRegions', ['us-east-1', 'eu-west-1']);

    shouldReject('progressCheckIntervalInSeconds', undefined);
    shouldReject('progressCheckIntervalInSeconds', -1);
    shouldReject('progressCheckIntervalInSeconds', 'value');
    shouldAccept('progressCheckIntervalInSeconds', 10);

    // The actually optional options property passed to AWS clients.
    shouldReject('clientOptions', 'value');
    shouldAccept('clientOptions', {});
    shouldAccept('clientOptions', undefined);

    // Adding extra unwanted property.
    shouldReject('x', 'value');
  });
});
