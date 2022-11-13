package main

import (
	"bundler/config"
	"bundler/controller"
	"bundler/eth"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

func handler(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	path, ok := request.PathParameters["proxy"]
	if !ok {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Body:       "Bad Request",
		}, nil
	}

	switch path {
	case "healthz":
		return controller.Healthz(request)
	case "handle":
		return controller.HandleOps(request)
	default:
		return events.APIGatewayProxyResponse{
			Body:       fmt.Sprintf("Not Found for request %v.", request),
			StatusCode: 404,
		}, nil
	}
}

func init() {
	config.InitFromAWSSecret()
	eth.Init()
}

func main() {
	lambda.Start(handler)
}
