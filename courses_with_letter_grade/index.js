require("dotenv").config();

const canvas = require("@kth/canvas-api")(
  process.env.CANVAS_API_URL,
  process.env.CANVAS_API_TOKEN
);
let count = 0;
let totalHT19 = 0;
let total = 0;
let countPerGrading = {};
async function get() {
  const courses = canvas.list(`/accounts/1/courses`, {
    per_page: 100,
    page: 100
  });
  for await (const course of courses) {
    total++;
    if (course.sis_course_id && course.sis_course_id.match(/.*HT19.*/)) {
      totalHT19++;
      for await (const assignment of canvas.list(
        `courses/${course.id}/assignments`
      )) {
        if (assignment.grading_type === "letter_grade") {
          count++;
          countPerGrading[assignment.grading_standard_id] =
            countPerGrading[assignment.grading_standard_id] || 0;

          countPerGrading[assignment.grading_standard_id] =
            countPerGrading[assignment.grading_standard_id] + 1;

          console.log(
            "Found one for course:",
            course.sis_course_id,
            count,
            totalHT19
          );
          break; // NOTE: to count assignments per grading, remove this break to count all assignments with letter grade, not just one per course room
        }
      }
    }
  }
  console.log("Total: ", count, totalHT19, total, countPerGrading);
}

get();
