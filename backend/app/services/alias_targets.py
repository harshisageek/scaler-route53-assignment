MOCK_ALIAS_TARGETS: dict[str, frozenset[str]] = {
    "cloudfront": frozenset({"d111111abcdef8.cloudfront.net."}),
    "s3-website": frozenset({"example-bucket.s3-website-us-east-1.amazonaws.com."}),
    "load-balancer": frozenset({"dualstack.example.us-east-1.elb.amazonaws.com."}),
    "api-gateway": frozenset({"d-example.execute-api.us-east-1.amazonaws.com."}),
}
