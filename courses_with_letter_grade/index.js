require('dotenv').config()

const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
let count = 0
let totalHT19 = 0
async function get(){
    const courses = canvas.list(`/accounts/1/courses`, {per_page: 100, page:100})
    for await (const course of courses) {
        totalHT19 ++
        if(course.sis_course_id && course.sis_course_id.match(/.*HT19.*/)){
            for await (const assignment of canvas.list(`courses/${course.id}/assignments`)){
                if(assignment.grading_type === 'letter_grade'){
                    count ++
                    console.log('Found one for course:', course.sis_course_id, count, totalHT19)
                    break
                }
            }
        }
    }

}

get()
