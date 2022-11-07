import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class UbutuBasedEc2InstanceCdkStack extends Stack {
  declare someAmiId: ec2.IMachineImage
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
      }
    });

    const defaultVpc = ec2.Vpc.fromLookup(this, 'VPC', {
      isDefault: true
    })

    const userData = ec2.UserData.forLinux()
    userData.addCommands(
      'apt-get update -y',
      'apt-get install -y git awscli ec2-instance-connect',
      'until git clone https://github.com/aws-quickstart/quickstart-linux-utilities.git; do echo "Retrying"; done',
      'cd /quickstart-linux-utilities',
      'source quickstart-cfn-tools.source',
      'qs_update-os || qs_err',
      'qs_bootstrap_pip || qs_err',
      'qs_aws-cfn-bootstrap || qs_err',
      'mkdir -p /opt/aws/bin',
      'ln -s /usr/local/bin/cfn-* /opt/aws/bin/'
    )

    const machineImage = ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id',
      {
        os: ec2.OperatingSystemType.LINUX,
        userData: userData
      }
    )
    

    // Adding a security group to EC2
    const myVmSecurityGroup = new ec2.SecurityGroup(this, 'myVmSecurityGroup', {
      vpc: defaultVpc
    })

    myVmSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "httpIpv4")
    myVmSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), "httpIpv6")

    const myVm = new ec2.Instance(this, 'myVm', {
      // The type of instace to deploy (e.g. a 't2.micro')
      instanceType: new ec2.InstanceType("t2.micro"),

      // The ID of the image to use for the instance
      machineImage: machineImage,

      // A reference to the object representong the VPC
      // you want to deploy the instance to. 
      // (we are using the default VPC in your AWS account.)
      vpc: defaultVpc,

      // Adding a security group
      securityGroup: myVmSecurityGroup,

      // Installing software by using CloudFormation init.
      // execute init scripts once a machine boots.
      init: ec2.CloudFormationInit.fromElements(
        ec2.InitCommand.shellCommand('sudo apt-get update -y'),
        ec2.InitCommand.shellCommand('sudp apt-get install -y nginx'), // Install nginx
      )

      // ... more configuration
    })

    const webVmUrl = new CfnOutput(this, 'webVmUrl', {
      value: `http://${myVm.instancePublicIp}/`,
      description: `The URL of my instance.`,
      exportName: `webVmUrl`
    })

  }
}
