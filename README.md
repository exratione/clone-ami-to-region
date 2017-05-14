# Clone an AMI to Another Region

Amazon provides [an API endpoint][1] to copy an AMI from one region to another.
Unfortunately it doesn't copy over launch permissions and tags. When building
AMIs for a service that is distributed across multiple regions, this can be
quite annoying, as one usually wants the same launch permissions, name, and
other tags to be applied to the copied AMIs.

It doesn't sound onerous to copy the tags and permissions over, but in the
context of a bash script or other devops code, it is actually a fair few
commands, as well as needed error handling and retries. Abstracting that into a
single package like this is helpful; it saves time when there are scores of
different applications and devops setups that need the task performed.

The devops model that this package helps with is as follows: create a single AMI
for a release in one environment and region, then clone it to all desired
regions. Deploy new stacks based on that AMI and use an instance userdata script
to apply the correct configuration for the run environment as the instance comes
up.

## Installation

```
npm install clone-ami-to-region
```

## Scope of Cloning

This only copies over the following items to the new AMI in the new region:

  * Name.
  * Description.
  * Tags.
  * Launch permissions.

None of the other image attributes should be copied in such a scenario, as they
are either involved in other processes where the cloning is done for you (such
as [product codes and the marketplace][2]), or cannot be set via the EC2 API in
any case.

## Usage

```
var cloneAmiToRegion = require('clone-ami-to-region');

cloneAmiToRegion.cloneImage({

  // --------------------------------------------------------------
  // Required configuration.
  // --------------------------------------------------------------

  // Provide the source AMI ID.
  sourceImageId: 'ami-11223344',

  // The region that contains the source AMI.
  sourceRegion: 'us-east-1',

  // An array of regions to clone the AMI to.
  destinationRegions: [
    'eu-west-1',
    'eu-west-2'
  ],

  // --------------------------------------------------------------
  // Optional configuration.
  // --------------------------------------------------------------

  // AWS credentials will be taken from the environment if not provided, and
  // that is the preferred methodology. Credentials and other configuration can
  // be provided directly, however.
  // clientOptions: {
  //   accessKeyId: 'akid',
  //   secretAccessKey: 'secret'
  // }

  // It usually takes a few minutes for a copy to complete. This determines the
  // frequency with which completion is checked.
  progressCheckIntervalInSeconds: 30,

}, function (error, results) {
  if (error) {
    console.error(error);
  }

  // A results object is always returned, regardless of error status. It shows
  // the details of success or failure for each of the destinaton regions. It
  // has the form:
  //
  // {
  //   'eu-west-1': {
  //     imageId: 'ami-11223344',
  //     success: true
  //   },
  //   'us-west-2': {
  //     error: new Error(''),
  //     success: false
  //   },
  //   ...
  // }
  //
  console.info(JSON.stringify(results, null, '  '));
});
```

[1]: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#copyImage-property
[2]: https://aws.amazon.com/marketplace/help/200940360#topic5

