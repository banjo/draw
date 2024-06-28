#!/bin/bash

echo "Stopping docker..."
nr db:local:stop

echo "Starting database..."
nr db:local:start

echo "Reseting database..."
nr db:local:reset

