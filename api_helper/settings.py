import os

db_server = os.environ.get('DB_HOST_READER', 'db-read.pinme.io')
db_user = os.environ.get('DB_USER', 'admin')
db_password = os.environ.get('DB_PASSWORD')
db_database = os.environ.get('DB_DATABASE', 'traccar')

traccar_api_baseurl = os.environ.get('TRACCAR_API_BASE_PATH')
sms_gateway_baseurl = os.environ.get('SMS_GATEWAY_URL', 'https://api.pinme.io/gateway/')
sms_gateway_token = os.environ.get('SMS_GATEWAY_TOKEN')
