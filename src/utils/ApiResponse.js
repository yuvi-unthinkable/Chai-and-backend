class ApiResponse {
    constructor(StatusCode, data, message = "Sucess") {
        this.StatusCode = StatusCode
        this.data = data
        this.message = message
        this.sucess = StatusCode < 400

    }
}

export { ApiResponse };