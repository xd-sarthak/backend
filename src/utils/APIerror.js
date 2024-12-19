class ApiError extends Error{
    constructor(
        statusCode,
        message = "something went wrong",
        errors = [],
        stackTr = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if(stackTr){
            this.stack = stackTr
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}