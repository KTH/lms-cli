require('dotenv').config()

const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)

async function get(){
    const courses = canvas.list(`/accounts/1/courses`)
    for await (const course of courses) {
        if(course.sis_course_id && course.sis_course_id.match(/.*HT19.*/)){
            console.log('found one:', course)
        }
    }

}

get()
