TOBENILEPT
========================

TOBENILEPT utilizes LINE Business Connect, with the message delivery platform LINE, users may interact with our program may interact with end users. Service such as push notifications for user subscribed bus status is provided, more services may be provided in the future. TOBENILEPT is named after the reverse of TPE LINE BOT, this is a outsourced project from Taipei City Government.

## Architecture

TOBENILEPT is consisted of the following four main components, they share a MySQL database and a Redis database in order to communicate with each other.

### Distributor

Schedules the distribution of users' subscription. Fetches and pushes users' subscribed information to destination devices via LINE API upon triggering of scheduled job.

### Endpoint

Associated with LINE channel settings, receives user input. To prevent timeout of connections, those received messages are stored into the database quickly after simple processing procedures. Since the Endpoint itself involves no race condition, it may be deployed on multiple web servers with load balancer if required. Since aggregation of messages is performed by LINE application servers before Endpoint calls, we could assume that Endpoint may not confront problems related with scaling up.

### Fetcher

Fetches bus route, stop info, estimated arrival time from Data.Taipei periodically. Bus route and stop info are stored in the MySQL database, while estimated arrival time is stored in Redis.

### Processor

Fetches and processes users' input from message queue stored in the database chronologically. Maintains a state machine and stores parameters for each user to perform the flow control. Performs CRUD operations for users' subscription data stored in the database. Replies results to each user via LINE API. Since the Processor processes user input in batch and marks fetched messages, there may be dependencies between rows of messages. We suggest only one Processor should be running at the same time. Horizontal partitioning based on user ID is sugessted if scaling up in the future is expected.

## System Requirements
 - **Endpoint**: Web server such as IIS / Apache / nginx with PHP 5.6+
 - **Processor**, **Distributor**: Node.js
 - **Database**: MySQL 5.7+
