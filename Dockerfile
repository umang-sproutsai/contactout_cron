FROM ubuntu:latest

# Install necessary packages and Logstash
RUN apt-get update && \
    apt-get install -y curl python3 python3-pip gcc g++ openjdk-11-jdk && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json /app/

RUN npm install

COPY . /app/

CMD ["npm", "start"]