export const parseArgs = (args) => {
    const result = {};
    // TODO: how do these come in when passed from the shell?
    // args.slice(2).forEach((arg) => {
    args.forEach((arg) => {
        const [key, value] = arg.replace(/^--/, "").split("=");
        result[key] = value;
    });
    return {
        watch: result.hasOwnProperty("watch"),
        sri: result["sri"]?.split(","),
    };
};
