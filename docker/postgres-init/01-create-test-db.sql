-- Chỉ chạy khi volume dữ liệu còn trống. Nếu volume đã tồn tại: `npm run db:reset` hoặc tạo tay:
--   docker exec sofinhub-postgres psql -U sofinhub -c "CREATE DATABASE sofinhub_test"
CREATE DATABASE sofinhub_test OWNER sofinhub;
