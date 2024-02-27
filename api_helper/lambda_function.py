import settings
import sys
import pymysql
import hashlib
import requests
import json

# Database connection
try:
    db_connection = pymysql.connect(settings.db_server, user=settings.db_user, passwd=settings.db_password,
                                    db=settings.db_database, connect_timeout=10, autocommit=True)
except pymysql.MySQLError as e:
    print("Database error")
    print(e)
    sys.exit(1)


def main(event, context):
    global user_details
    print(event)

    try:
        if event['httpMethod'] == "OPTIONS":
            return response_type1_event('', '', event)
    except:
        pass

    try:
        body = json.loads(event['body'])
    except:
        return response_type1_event('', '', event)

    print("Called via API " + settings.traccar_api_baseurl)
    # Called via Lambda IDE/localhost

    # if event['headers']['cookie'][0:11] == "JSESSIONID=":
    login_response = requests.get(settings.traccar_api_baseurl + '/session',
                                  headers={'cookie': event['headers']['Cookie']})

    print("Login result: " + str(login_response.status_code) + " " + login_response.text)

    if login_response.status_code != 200:
        return response_type1_event(False, 'Invalid authentication!', event)
    # else:
    #	return response_type1_event(False, "Missing session", event)

    # Check for missing parameter in BODY
    for parameter in ['username', 'command']:
        if not parameter in body:
            return response_type1_event(False, "Missing global parameters", event)

    # Get user details
    user_details = query("""
		SELECT *
		FROM tc_users
		WHERE email LIKE '""" + body['username'] + """'
		LIMIT 1
		""").fetchone()

    if user_details == None:
        return response_type1_event(False, "Authentication failed", event)

    print("User details: " + str(user_details))

    # Add allowed vehicles to the user details
    user_details['vehicles'] = query("""
		SELECT *
		FROM tc_devices
		LEFT JOIN bo_device_details ON bo_device_details.deviceid = tc_devices.id
		WHERE id IN (SELECT deviceid FROM tc_user_device WHERE userid = """ + str(user_details['id']) + """)
		OR groupid IN (SELECT groupid FROM tc_user_group WHERE userid = """ + str(user_details['id']) + """)
		ORDER BY name
		""").fetchall()

    if body['command'] == "immobilization":
        # Check for missing parameter in BODY
        for parameter in ['value', 'deviceid']:
            if not parameter in body:
                return response_type1_event(False, "Missing specific parameters", event)

        print("Command: " + body['command'])
        print("DeviceID: " + str(body['deviceid']))
        print("Value: " + str(body['value']))

        for device in user_details['vehicles']:
            if device['id'] == body['deviceid']:
                d = json.loads(device['attributes'])
                if 'deviceType' in d.keys() and d['deviceType'] == 7:
                    # Concox
                    print("Device type: Concox")

                    if body['value'] == True:
                        request_body = {
                            "id": 29,
                            "deviceId": body['deviceid']
                        }
                        sms_result = send_sms(device['phone'], "RELAY,1%23", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                    else:
                        sms_result = send_sms(device['phone'], "RELAY,0%23", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        request_body = {
                            "id": 30,
                            "deviceId": body['deviceid']
                        }

                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)

                    if 200 <= response.status_code <= 299:
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)
                elif 'deviceType' in d.keys() and d['deviceType'] == 30:
                    # Vitana
                    print("Device type vitana")
                    if body['value'] == True:
                        request_body = {
                            "id": 51,
                            "deviceId": body['deviceid']
                        }
                        sms_result = send_sms(device['phone'], "0000,900,1,1,0,15", str(user_details['email']))
                    else:
                        sms_result = send_sms(device['phone'], "0000,900,1,0,0,0", str(user_details['email']))
                        request_body = {
                            "id": 52,
                            "deviceId": body['deviceid']
                        }
                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)
                    if 200 <= response.status_code <= 299:
                        sms_result = send_sms(device['phone'], "0000,800", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)
                elif 'deviceType' in d.keys() and d['deviceType'] == 3:
                    # Coban
                    print("Device type: Coban")

                    if body['value'] == True:
                        request_body = {
                            "id": 5,
                            "deviceId": body['deviceid']
                        }
                    else:
                        request_body = {
                            "id": 6,
                            "deviceId": body['deviceid']
                        }

                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)

                    if 200 <= response.status_code <= 299:
                        sms_result = send_sms(device['phone'], "check123456", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)
                elif 'deviceType' in d.keys() and d['deviceType'] == 25:
                    print("Device type: BWS")

                    if body['value'] == True:
                        request_body = {
                            "type": "custom",
                            "description": "custom",
                            "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "ENGOFF"
                            }
                        }
                        sms_result = send_sms(device['phone'], "ENGOFF", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                    else:
                        sms_result = send_sms(device['phone'], "ENGON", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        request_body = {
                            "type": "custom",
                            "description": "custom",
                            "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "ENGON"
                            }
                        }

                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)

                    if 200 <= response.status_code <= 299:
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)
                elif 'deviceType' in d.keys() and d['deviceType'] == 14:
                    print("Device type: Mobilogix")

                    if body['value'] == True:
                        request_body = {
                            "type": "custom",
                            "description": "custom",
                            "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "[2022-03-03 19:35,S6,RELAY=1]"
                            }
                        }
                    # sms_result = send_sms(device['phone'], "SET RELAY=1", str(user_details['email']))
                    # print(sms_result.status_code)
                    # print(sms_result.text)
                    else:
                        sms_result = send_sms(device['phone'], "SET RELAY=0", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        request_body = {
                            "type": "custom",
                            "description": "custom",
                            "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "[2022-03-03 19:35,S6,RELAY=0]"
                            }
                        }

                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)

                    if 200 <= response.status_code <= 299:
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)
                elif 'deviceType' in d.keys() and d['deviceType'] == 1:
                    # Inofleet

                    print("Device type: Inofleet")
                    # command_6bit = "09000120"
                    if body['value'] == True:
                        command_6bit = "09000500300<g"
                        command_hex = "FE-09-00-00-05-00-00-C0-00-CC-FF"
                    else:
                        command_6bit = "090005002008g"
                        command_hex = "FE-09-00-00-05-00-00-80-00-8C-FF"

                    print("Sending to redis...")
                    call_send_to_redis(device['uniqueid'], command_hex)

                    print("Sending via SMS...")
                    response = send_sms(device['phone'], command_6bit, str(user_details['email']))

                    if response.status_code == 200 or response.status_code == 201:
                        return response_type1_event(True, "Sent via SMS", event)
                    else:
                        # return response_type1(False, response.content.decode("utf-8"))
                        return response_type1_event(False, "SMS error " + str(response.status_code), event)
                else:
                    # Teltonika
                    print("Device type: Teltonika")
                    request_body = {
                        "id": 19,
                        "deviceId": body['deviceid']
                    }
                    response = call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                                request_body)

                    # immobiliation on
                    if body['value'] == True:
                        request_body = {"id": 10, "deviceId": body['deviceid']}
                        call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                         request_body)
                        request_body = {
                            "type": "custom", "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "setdigout 11"
                            }
                        }
                        call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                         request_body)
                    else:
                        request_body = {
                            "type": "custom", "deviceId": body['deviceid'],
                            "attributes": {
                                "data": "setdigout 00"
                            }
                        }
                        call_traccar_api(body['username'], event['headers']['cookie'], "POST", "commands/send",
                                         request_body)
                        request_body = {"id": 11, "deviceId": body['deviceid']}
                        response = call_traccar_api(body['username'], event['headers']['cookie'], "POST",
                                                    "commands/send", request_body)
                    print('response: ', response)
                    if 200 <= response.status_code <= 299:

                        request_body["id"] = 18
                        response = call_traccar_api(body['username'], event['headers']['cookie'], "POST",
                                                    "commands/send", request_body)
                        sms_result = send_sms(device['phone'], "\u2008\u2008getrecord", str(user_details['email']))
                        print(sms_result.status_code)
                        print(sms_result.text)
                        return response_type1_event(True, "Sent via API", event)
                    else:
                        return response_type1_event(False, "API error: " + response.text, event)

        return response_type1_event(False, "User has no access to deviceid " + str(body['deviceid']), event)

    return response_type1_event(False, "Unknown command", event)


def call_traccar_api(username, cookie, method, api, body):
    headers = {
        'Content-Type': 'application/json',
        'cookie': cookie
    }

    print("Calling HTTP " + method + " " + settings.traccar_api_baseurl + "/api/" + api + " data: " + json.dumps(
        body) + " cookie: " + cookie)

    if method == "POST":
        response = requests.post(settings.traccar_api_baseurl + "/api/" + api, headers=headers, data=json.dumps(body))
    elif method == "GET":
        response = requests.get(settings.traccar_api_baseurl + "/api/" + api, headers=headers, data=json.dumps(body))
    else:
        print("Unknown method")

    print("API result: " + str(response.status_code) + " " + response.text)

    return response


def call_send_to_redis(imei, command):
    url = "https://api.pinme.io/alblambda/commands/send/uCQ3HxR5d87gvSRIPcjm/" + imei + "/" + command
    try:
        print("Calling " + url)
        result = requests.get(url)
        print("Got response: " + str(result))
    except Exception as e:
        result = False
        print("Got error: " + str(e))

    return result


def send_sms(msisdn, message, user):
    print("Sending SMS - ", settings.sms_gateway_baseurl + "?token=" + settings.sms_gateway_token + "&msisdn=" + str(
        msisdn) + "&message=" + str(message))
    url = settings.sms_gateway_baseurl + "?token=" + settings.sms_gateway_token + "&msisdn=" + str(
        msisdn) + "&message=" + str(message) + "&user=" + str(user)
    # url = "https://api.twilio.com/2010-04-01/Accounts/ACa3ce15459d40351e614ff05f358915af/Messages.json"
    # payload = {'To': msisdn, 'From': '15864967972', 'Body': message }
    # s = requests.Session()
    # s.auth = ('ACa3ce15459d40351e614ff05f358915af', 'a3c6b9c3c31c4f27588f96a69d744afb')
    print(url)
    # print(payload)
    # print(s.auth)
    # res = s.post(url, payload)
    res = requests.get(url)
    print(res)
    return res


def query(query):
    with db_connection.cursor(pymysql.cursors.DictCursor) as cur:
        cur.execute(query)
    return cur


def response_type1_event(success, details, event):
    output = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": event['headers']['origin'],
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Credentials": "true"
        },
        "body": json.dumps({
            "success": success,
            "details": str(details)
        })
    }
    print("Response: " + str(output))
    return output


def response_type2_event(success, details, event):
    output = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": event['headers']['origin'],
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Credentials": "true"
        },
        "body": json.dumps({
            "success": success,
            "details": details
        })
    }
    print("Response: " + str(output))
    return output


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha1', bytearray.fromhex(password.encode('utf-8').hex()), bytearray.fromhex(salt), 1000,
                               24).hex()


if len(sys.argv) > 1:
    print("Called from command line")
