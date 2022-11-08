package main

import (
	// "bundler/config"
	"bundler/controller"
	"bundler/eth"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

func handler(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if request.Path == "/handle" && request.HTTPMethod == "POST" {
		return controller.HandleOps(request)
	}

	return events.APIGatewayProxyResponse{
		Body:       "Not Found",
		StatusCode: 404,
	}, nil
}

func init() {
	// config.InitFromSecret() // TODO
	eth.Init()
}

func main() {
	lambda.Start(handler)
}
