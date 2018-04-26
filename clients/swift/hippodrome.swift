//
//  hippodrome.swift
//
//  Created by John O'Sullivan on 3/31/18.
//  Copyright © 2018 John O'Sullivan. All rights reserved.
//

import Foundation
import SocketIO

enum HttpMethod : String {
    case GET
    case POST
    case DELETE
    case PUT
}

enum HippodromeType: String {
    case SESSION_PRESTART
    case SESSION_COUNTDOWN_START
    case SESSION_COUNTDOWN_INTERVAL
    case SESSION_COMPLETED_OVERVIEW
    case SESSION_GO
    case JOIN_SESSION_FOUND
    case SESSION_PLAYER_READY
    case SESSION_PLAYER_DISCONNECTED
    case SESSION_PLAYER_NOT_READY
    case SESSION_FRAME
}

class HttpClientAPI: NSObject{

    var request : URLRequest?
    var session : URLSession?

    static func instance() ->  HttpClientAPI{ return HttpClientAPI() }

    func makeAPICall(url: String,params: Dictionary<String, Any>?, method: HttpMethod, auth: String, success:@escaping ( Data? ,HTTPURLResponse?  , NSError? ) -> Void, failure: @escaping ( Data? ,HTTPURLResponse?  , NSError? )-> Void) {

        request = URLRequest(url: URL(string: url)!)
        print("URL = \(url)")

        if let params = params {
            let  jsonData = try? JSONSerialization.data(withJSONObject: params, options: .prettyPrinted)
            request?.setValue("application/json", forHTTPHeaderField: "Content-Type")

            if (auth != "") { request?.setValue(auth, forHTTPHeaderField: "Authorization") }
            if (method != .GET) { request?.httpBody = jsonData }

        }
        request?.httpMethod = method.rawValue

        let configuration = URLSessionConfiguration.default

        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 30

        session = URLSession(configuration: configuration)
        session?.dataTask(with: request! as URLRequest) { (data, response, error) -> Void in
            if let data = data {
                if let response = response as? HTTPURLResponse, 200...299 ~= response.statusCode {
                    success(data , response , error as NSError?)
                } else {
                    failure(data , response as? HTTPURLResponse, error as NSError?)
                }
            } else {
                failure(data , response as? HTTPURLResponse, error as NSError?)
            }
        }.resume()
    }

}

class hippodrome: NSObject {

    static let sharedInstance = hippodrome()
    static let base_endpoint = "https://gshippodrome.herokuapp.com"
    static let auth_endpoint = base_endpoint + "/api/auth/authenticate"
    static let readySession_endpoint = base_endpoint + "/api/readyForSession"
    static let verify_endpoint = base_endpoint + "/api/auth/verify"

    var socket = SocketIOClient(socketURL: URL(string: base_endpoint)!, config: [.log(false), .compress])
    var session_auth_token = ""
    public var rand_user = ""
    var session_id = ""
    var function_name = ""

    private var players:[[String: Any]] = []
    private var results:[[String: Any]] = []

    var completionFrameHandler: (Any) -> Void?
    var completionSessionHandler: (HippodromeType, Any) -> Void?

    func setPlayers(players: [[String: Any]]) {
        self.players = players
    }

    func getPlayers() -> [[String: Any]] {
        return self.players
    }

    func setResults(results: [[String: Any]]) {
        self.results = results
    }

    func getResults() -> [[String: Any]] {
        return self.results
    }

    override init() {
        //super.init()
        let temp_handler: (Any) -> Void = { success in }
        self.completionFrameHandler = temp_handler;
        self.completionSessionHandler = temp_handler;
    }

    func configure() {
        socket.on(clientEvent: .connect) {data, ack in
            self.socket.emit("confirmedSession", ["token":self.session_auth_token,"rand_user":self.rand_user])
        }
    }

    func playerPubSub(handler: @escaping (_ type:HippodromeType,_ data: Any) -> Void) {
        self.completionSessionHandler = handler
        socket.on(self.rand_user) {data, ack in
            if let arr = data as? [[String: Any]] {
                let type = arr[0]["type"] as? String
                if (type! == "JOIN_SESSION_FOUND") {
                    self.function_name = (arr[0]["function_name"] as? String)!
                    self.session_id = (arr[0]["session_id"] as? String)!
                    self.completionSessionHandler(.JOIN_SESSION_FOUND,data);
                    self.socket.on(self.function_name) {data, ack in
                        self.completionSessionHandler(.SESSION_FRAME,data);
                    }
                } else if (type! == "SESSION_PRESTART") {
                    self.completionSessionHandler(.SESSION_PRESTART,data);
                } else if (type! == "SESSION_PLAYER_READY") {
                    self.completionSessionHandler(.SESSION_PLAYER_READY,data);
                } else if (type! == "SESSION_PLAYER_NOT_READY") {
                    self.completionSessionHandler(.SESSION_PLAYER_NOT_READY,data);
                } else if (type! == "SESSION_PLAYER_NOT_READY") {
                    self.completionSessionHandler(.SESSION_PLAYER_NOT_READY,data);
                } else if (type! == "SESSION_PLAYER_NOT_READY") {
                    self.completionSessionHandler(.SESSION_PLAYER_NOT_READY,data);
                } else if (type! == "SESSION_COUNTDOWN_START") {
                    self.completionSessionHandler(.SESSION_COUNTDOWN_START,data);
                } else if (type! == "SESSION_COUNTDOWN_INTERVAL") {
                    self.completionSessionHandler(.SESSION_COUNTDOWN_INTERVAL,data);
                } else if (type! == "SESSION_COMPLETED_OVERVIEW") {
                    self.completionSessionHandler(.SESSION_COMPLETED_OVERVIEW,data);
                } else if (type! == "SESSION_PLAYER_DISCONNECTED") {
                    self.completionSessionHandler(.SESSION_PLAYER_DISCONNECTED,data);
                } else if (type! == "SESSION_GO") {
                    self.completionSessionHandler(.SESSION_GO,data);
                }
            }
        }
    }

    func logout() {
        self.session_auth_token = "";
    }

    func isValidToken(result: @escaping (_ success: Bool) -> Void) {
        // Preparing the headers
        let auth_token = "Bearer " + session_auth_token
        let paramsDictionary = [String:Any]()
        // HttpClientAPI makes the API readyForSession call to the server
        HttpClientAPI.instance().makeAPICall(url: hippodrome.verify_endpoint, params:paramsDictionary, method: .GET,auth: auth_token, success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                print(json)
                let success = json["success"] as! Bool
                result(success)
            } catch let error as NSError {
                print("Failed: \(error.localizedDescription)")
                result(false)
            }
        }, failure: { (data, response, error) in
            result(false)
        })
    }

    func sessionPrestartConfirm(handler: @escaping (_ type:HippodromeType, _ data: Any) -> Void) {
        self.completionSessionHandler = handler;
        self.socket.emit("sessionPrestartConfirm", ["token": self.session_auth_token])
    }

    func completedRound(results: Any) { self.socket.emit("completedRound", ["token": self.session_auth_token, "results": results]) }

    func playerReady() { self.socket.emit("playerReady", ["token": self.session_auth_token]) }

    func sendFrame(payload: Any) { self.socket.emit("sendFrame", ["payload": payload, "function_name": self.function_name, "session_id": self.session_id]) }

    func leaveSession() { self.socket.emit("leaveSession", ["token": self.session_auth_token,  "rand_user": self.rand_user, "session_id": self.session_id]) }

    func readyForMatchMaking(handler: @escaping (_ type:HippodromeType, _ data: Any) -> Void) {
        if (self.session_auth_token != "") {
            // Preparing the headers
            let auth_token = "Bearer " + session_auth_token
            let paramsDictionary = [String:Any]()
            // HttpClientAPI makes the API readyForSession call to the server
            HttpClientAPI.instance().makeAPICall(url: hippodrome.readySession_endpoint, params:paramsDictionary, method: .GET,auth: auth_token, success: { (data, response, error) in
                do {
                    let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                    self.rand_user = json["rand_user"] as! String
                    self.playerPubSub(handler: handler)
                    self.socket.connect()
                } catch let error as NSError {
                    print("Failed: \(error.localizedDescription)")
                }
            }, failure: { (data, response, error) in
                print(response as Any)
            })
        }
    }

    func authenticate(username: String, password: String, handler: @escaping (_ sucess: Bool, _ error: Any) -> Void) {
        // Preparing the authenticate API call
        var paramsDictionary = [String:Any]()
        paramsDictionary["username"] = username
        paramsDictionary["password"] = password
        // HttpClientAPI makes the API authenticate call to the server
        HttpClientAPI.instance().makeAPICall(url: hippodrome.auth_endpoint, params:paramsDictionary, method: .POST,auth: "", success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                self.session_auth_token = json["token"] as! String
                handler(true, error as Any)
            } catch let error as NSError {
                print("Failed: \(error.localizedDescription)")
                handler(false,error)
            }
        }, failure: { (data, response, error) in
            print(response as Any)
            handler(false, error!)
        })
    }
}
