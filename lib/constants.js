/**
 * @fileOverview Constants.
 */

// Only the attributes we care about; there are others. See:
// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#describeImageAttribute-property
exports.imageAttributes = {
  LAUNCH_PERMISSION: 'launchPermission'
};
// The property name in the returned attribute data.
exports.describeImageAttributesProperty = {
  launchPermission: 'LaunchPermissions'
};
// The property name in the modification parameters.
exports.modifyImageAttributesProperty = {
  launchPermission: 'LaunchPermission'
};
